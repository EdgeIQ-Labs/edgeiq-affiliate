# Product Specification: Relay — Privacy-First Affiliate Marketing

**Author:** EdgeIQ Labs Engineering
**Date:** September 14, 2026
**Status:** Draft / MVP Blueprint
**Target:** Internal dogfooding → Open-source release → Commercial product

---

## 1. Product Name

| Option | Rationale |
|--------|-----------|
| **EdgeIQ Partner** | Safe, corporate. Boring. Doesn't signal the privacy differentiator. |
| **ZeroTrust Affiliates** | Strong security branding, but too long and sounds like a network policy. |
| **Relay** | Short, memorable, implies passing data without reading it. Aligns with "we relay signals, we don't snoop." |

**Recommendation: Relay** (marketed as *Relay by EdgeIQ*). The domain `relay.aff` or `use-relay.com` can be acquired cheaply. It positions the tool as infrastructure, not just another SaaS dashboard.

---

## 2. Core Features (MVP)

The v1 must be usable for EdgeIQ's own $29/$49 SMB plans immediately. No feature bloat.

- **Partner registration & approval flow** — affiliates sign up, admin approves, they get a unique referral link.
- **Click tracking** — lightweight redirect service that logs clicks, sets attribution cookie, redirects to Stripe checkout.
- **Stripe webhook ingestion** — receives `checkout.session.completed` and `invoice.paid` events to confirm conversions. Zero read access required.
- **Commission calculation engine** — flat percentage or fixed amount per plan. Configurable per partner tier.
- **Partner dashboard** — read-only view of clicks, conversions, pending/paid commissions.
- **Admin dashboard** — manage partners, configure commission rules, view aggregate stats, trigger manual payouts.
- **Payout ledger** — tracks what is owed. Manual payout marking (no automated bank transfers in MVP).
- **Docker Compose deployment** — single `docker compose up` to run everything.

**Explicitly out of scope for MVP:** Multi-tier/nested affiliates, automated tax forms, PayPal/Wise auto-payouts, custom domains for tracking links, A/B testing.

---

## 3. Architecture

### Guiding Principle
Must run identically on EdgeIQ's Proxmox/Docker infra AND be deployable on Cloudflare Workers/Pages for users who want edge deployment. This means the core logic must be stateless HTTP handlers, and the database layer must be abstracted.

### Recommended Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Runtime** | Hono (TypeScript) | Runs natively on Cloudflare Workers, Node.js, Bun, and Deno. Single codebase for both deployment targets. Fast, minimal. |
| **Frontend** | React via Vite SPA | Partners/admins are authenticated users; SPA is fine. Keep it simple. Use shadcn/ui for components. |
| **Database (Docker)** | PostgreSQL + Drizzle ORM | Battle-tested, relational integrity matters for financial ledgers. Drizzle generates types and works with multiple backends. |
| **Database (CF Workers)** | Cloudflare D1 (SQLite) + Drizzle ORM | Same Drizzle schema, different driver. D1 is native to Workers. |
| **Auth** | Better Auth or Lucia Auth | Lightweight, no external dependency, works on both Node and Workers. JWT-based sessions for API access. |
| **Queue/Jobs** | In-memory for MVP, BullMQ (Redis) for Pro | Commission calculations on webhook receipt can be synchronous in MVP. |
| **Hosting** | Docker Compose (primary), wrangler.toml (secondary) | Docker for EdgeIQ's infra and self-hosters. CF Workers config included in repo for edge deployers. |

### Data Model (Core Tables)

```
partners: id, email, name, referral_code, status, created_at
tracking_events: id, partner_id, visitor_id, event_type (click/signup/sale), metadata, created_at
conversions: id, partner_id, stripe_checkout_session_id, plan_id, amount_cents, commission_cents, status (pending/paid), created_at
commission_rules: id, plan_id, type (percent/fixed), value, active
payouts: id, partner_id, amount_cents, method, status, created_at
```

---

## 4. How It Works Without Stripe Read Access

This is the core differentiator. Existing tools (Rewardful, FirstPromoter) ask for `read` scope on your Stripe account to pull customer lists, revenue totals, and subscription history. Relay never asks for that.

### The Webhook-Only Model

1. **Setup:** Merchant creates a Stripe webhook endpoint pointing to `https://relay.yourdomain.com/webhooks/stripe`. They select ONLY two events: `checkout.session.completed` and `invoice.paid`.
2. **Checkout Link Integration:** EdgeIQ's existing `buy.stripe.com` links get a `client_reference_id` or metadata parameter appended. When a visitor clicks a Relay tracking link, Relay redirects to the Stripe checkout URL with `?client_reference_id={visitor_id}` appended.
3. **Attribution:** When Stripe fires `checkout.session.completed`, the webhook payload includes `client_reference_id`. Relay matches this to the tracked visitor, identifies the referring partner, and creates a conversion record.
4. **Recurring Revenue:** When Stripe fires `invoice.paid` for subsequent months, the payload includes the subscription ID which was linked during the initial checkout. Relay credits recurring commissions automatically.
5. **Security:** Webhook signature verification via Stripe's signing secret (`STRIPE_WEBHOOK_SECRET`). No API keys with read permissions ever touch Relay.

### What Relay NEVER sees:
- Customer email addresses (unless passed in checkout metadata explicitly)
- Total account revenue
- Other customers' transactions
- Subscription details beyond what's in the specific webhook event
- Stripe API keys with any read scope

This is verifiable by any partner auditing the open-source code. The Stripe client initialization literally doesn't exist — there's only a webhook signature verifier.

---

## 5. Attribution Model

### Cookie-Based First-Click (MVP)

Keep it dead simple. Don't over-engineer attribution for v1.

1. Visitor lands on `relay.edgeiqlabs.com/r/{partner_code}`
2. Relay logs the click, generates a `visitor_id` UUID, sets a first-party cookie (`_relay_vid`) with 30-day expiry, and issues a 302 redirect to the Stripe checkout link with `client_reference_id={visitor_id}`.
3. If the visitor completes checkout, Stripe echoes back the `client_reference_id` in the webhook.
4. Relay matches visitor_id → partner, records conversion.

### Why first-click, not last-click?
For affiliate programs, first-click prevents partners from gaming the system by re-cookying existing prospects. It rewards the partner who introduced the customer. This is standard for SaaS affiliate programs.

### Cookie Lifetime
30 days default, configurable per merchant. Stored in `commission_rules` table.

### Handling buy.stripe.com Redirects
Since EdgeIQ uses pre-built Stripe checkout links (not Stripe Checkout Sessions API), we append query parameters directly:
```
Original: https://buy.stripe.com/abc123
Relay redirect: https://buy.stripe.com/abc123?client_reference_id=uuid-here
```
Stripe passes `client_reference_id` through to the webhook payload. This works without any changes to how EdgeIQ creates checkout links.

---

## 6. Partner Dashboard

What affiliates see when they log in. Must build trust through transparency.

### Views:
- **Overview:** Total clicks (all time / 30d), total conversions, conversion rate, total earnings, pending balance.
- **Links:** Their unique referral URLs. Copy button. QR code generation.
- **Activity Feed:** Chronological list of clicks and conversions. Conversions show plan name and commission amount. NO customer PII shown.
- **Payouts:** History of paid-out commissions. Current pending balance. Request payout button (sends notification to admin).
- **Attribution Audit:** A page explaining exactly how Relay tracks conversions, linking to the open-source repo. This is the trust-builder.

### What partners CANNOT see:
- Other partners' stats
- Customer emails or identities
- Merchant's total revenue
- Commission rules for other tiers

---

## 7. Admin Dashboard

What EdgeIQ (or any merchant) sees.

### Views:
- **Revenue Overview:** Total referred revenue, total commissions owed, total commissions paid. Filterable by date range.
- **Partners Management:** List all partners. Approve/reject applications. Edit commission rates per partner. Suspend fraudulent partners.
- **Conversions Log:** Every conversion with partner name, plan, amount, commission, timestamp. Searchable.
- **Commission Rules Engine:** Set default commission per plan (e.g., 20% recurring for $29 plan, 15% for $49 plan). Override per partner.
- **Payout Queue:** Partners who have requested payouts. Mark as paid after manual transfer. Export CSV for accounting.
- **Webhook Health:** Status of Stripe webhook deliveries. Retry failed events. Alert if webhooks stop arriving.
- **Settings:** Cookie duration, approval mode (auto vs manual), branding/logo for partner-facing pages.

---

## 8. Monetization Tiers

### Community Edition (Free, Open Source)
- MIT or AGPL-3.0 license (recommend AGPL to prevent SaaS wrappers without contributing back)
- Single merchant account
- Unlimited partners
- Basic partner + admin dashboards
- Docker Compose deployment
- Webhook-only Stripe integration
- Community support via GitHub Discussions
- **Purpose:** Distribution engine. Gets developers using it, builds brand awareness for EdgeIQ.

### Pro License (One-Time Fee: $299)
- Everything in Community, plus:
- Multi-team / multi-product support (manage multiple Stripe accounts/webhooks)
- Advanced analytics (cohort analysis, LTV tracking per partner, funnel drop-off)
- Custom commission structures (tiered rates, bonuses for milestones, first-month vs recurring split)
- White-label partner portal (custom domain, custom CSS, remove Relay branding)
- Email notifications (partners get notified on conversions)
- Priority support via Discord
- License key validation (phone-home to EdgeIQ for activation, works offline with grace period)
- **Why lifetime?** Developers hate subscriptions for infrastructure tools. Lifetime creates urgency and goodwill. $299 is impulse-buy territory for businesses making money from affiliates.

### Managed Service ($99/month)
- Everything in Pro, plus:
- EdgeIQ hosts it for you (multi-tenant SaaS)
- **Merchant of Record for payouts:** EdgeIQ handles paying affiliates globally, dealing with W-8BEN/W-9 collection, tax compliance, and 1099 reporting.
- Fraud detection (automated click-fraud flagging)
- SLA guarantee
- Dedicated account manager
- **Why this exists:** Paying international affiliates legally is genuinely hard. Companies will pay $99/mo to avoid becoming a de facto payroll company for their affiliates. This is where the real recurring revenue lives.

---

## 9. Tech Stack Recommendation (Opinionated)

Don't evaluate 15 options. Here's what to build with:

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **API Framework** | Hono | Universal runtime. Same code runs on CF Workers and Node/Bun. Tiny bundle. TypeScript-first. |
| **ORM** | Drizzle ORM | Type-safe, supports Postgres and SQLite/D1 with same schema definitions. No magic. |
| **Database** | PostgreSQL (Docker) / D1 (CF) | Relational integrity for financial data. Non-negotiable. |
| **Frontend** | React + Vite + shadcn/ui + Tailwind | Industry standard. AI assistants generate excellent React code. shadcn gives polished UI fast. |
| **Auth** | Better Auth | Modern, works on edge runtimes, supports magic links + password. No Auth0 dependency. |
| **Validation** | Zod | Runtime type checking for webhook payloads and API inputs. |
| **Testing** | Vitest | Fast, native ESM, works with Hono. |
| **CI/CD** | GitHub Actions | Standard. Build Docker image + publish to GHCR. |
| **Containerization** | Docker Compose with Bun runtime | Bun is faster than Node for Hono. Single Dockerfile. |
| **Monitoring** | Structured JSON logging → stdout | Pipe to whatever the user has (Loki, ELK, or just `docker logs`). |

### Project Structure
```
relay/
├── packages/
│   ├── core/          # Business logic, DB schemas, commission engine
│   ├── api/           # Hono routes (webhooks, REST API)
│   └── web/           # React SPA (dashboards)
├── docker-compose.yml
├── wrangler.toml
├── drizzle.config.ts
└── package.json       # pnpm workspace root
```
Monorepo with pnpm workspaces. `core` is shared between API and any future CLI tools.

---

## 10. MVP Timeline Estimate

Solo developer + AI coding assistant (Hermes/Claude Code). Assuming 4-6 hours/day focused work.

| Phase | Scope | Duration |
|-------|-------|----------|
| **Phase 1: Foundation** | Project scaffolding, Drizzle schema, Hono API skeleton, Docker Compose setup, auth flow | Week 1 |
| **Phase 2: Tracking Engine** | Click redirect handler, cookie logic, visitor_id generation, Stripe checkout URL rewriting | Week 2 |
| **Phase 3: Webhook Processing** | Stripe webhook receiver, signature verification, conversion matching, commission calculation | Week 3 |
| **Phase 4: Admin Dashboard** | React SPA shell, partner management CRUD, commission rules config, conversions table | Week 4 |
| **Phase 5: Partner Dashboard** | Partner login, stats overview, link generator, activity feed | Week 5 |
| **Phase 6: Dogfood Integration** | Wire up to EdgeIQ's actual Stripe account, test with real buy.stripe.com links, fix edge cases | Week 6 |
| **Phase 7: Polish & Ship** | README, docs, landing page, open-source licensing, GitHub release | Week 7 |

**Total: 7 weeks to public v1.** Aggressive but realistic with AI assistance handling boilerplate, tests, and component generation. The hardest part is Phase 3 (webhook edge cases) and Phase 6 (real-world testing).

---

## 11. Landing Page Copy Outline (for edgeiqlabs.com/relay)

### Hero Section
**Headline:** Your affiliates deserve transparency. Your Stripe account deserves privacy.
**Subheadline:** Relay is the open-source affiliate platform that tracks commissions without ever touching your Stripe API keys. Self-hosted. Auditable. Built by cybersecurity engineers who think read-access to your revenue data is insane.
**CTA:** [View on GitHub] [Try Live Demo]
**Visual:** Split screen — left side shows Rewardful asking for `stripe:read` scope (red X), right side shows Relay receiving a signed webhook (green check).

### Problem Section
**Header:** Why we built Relay
**Copy:** Every affiliate tool on the market asks you to hand over read access to your entire Stripe account. Your customer emails. Your MRR. Your transaction history. To a third-party SaaS company. We're a cybersecurity firm. We couldn't do it. So we built something better.

### How It Works (3 Steps)
1. **You point a webhook at us.** Select two Stripe events. That's it. No API keys. No OAuth scopes.
2. **We track referrals transparently.** Partners get links. Visitors get cookies. Conversions get matched via checkout reference IDs.
3. **Everyone trusts the math.** The attribution code is open-source. Your partners can read it. Try doing that with a black-box SaaS tool.

### Features Grid (6 cards)
- 🔒 **Zero Stripe Read Access** — Webhook-only architecture. We literally cannot see your dashboard.
- 🐳 **Self-Hosted in 60 Seconds** — One Docker Compose command. Your infra, your data.
- 🔍 **Auditable Attribution** — Open-source logic. Partners verify the math themselves.
- ⚡ **Edge-Ready** — Runs on Cloudflare Workers, Docker, or bare metal.
- 💰 **Flexible Commissions** — Percentage, fixed, recurring, per-plan. Your rules.
- 🛡️ **Built by Security Engineers** — From EdgeIQ Labs. We treat affiliate data like threat intel.

### Social Proof / Dogfood Section
**Header:** We eat our own cooking.
**Copy:** Relay powers the EdgeIQ affiliate program. Every partner who refers an EdgeIQ SMB plan gets tracked through the exact open-source code you're looking at. No hidden logic. No black boxes.

### Pricing Section

| Community | Pro | Managed |
|-----------|-----|---------||
| Free forever | $299 one-time | $99/month |
| Open source (AGPL) | Everything in Community | Everything in Pro |
| Unlimited partners | Multi-team support | We host it for you |
| Basic dashboards | Advanced analytics | Automated payouts |
| Docker self-hosted | White-label portal | Tax compliance handled |
| Community support | Priority Discord support | Dedicated account manager |
| [Get Started] | [Buy License] | [Contact Sales] |

### FAQ Section
- **"How do you track sales without Stripe access?"** → Explain webhook model simply.
- **"Can my partners really audit the code?"** → Yes, link to repo.
- **"Does this work with Stripe Payment Links?"** → Yes, specifically designed for buy.stripe.com compatibility.
- **"What happens if I stop paying for Pro?"** → You keep the license. It's yours forever. No hostage-ware.

### Footer CTA
**Header:** Stop giving SaaS companies read access to your revenue.
**CTA:** [Star on GitHub] [Deploy Now]

---

## Appendix: EdgeIQ Dogfooding Checklist

Before open-sourcing, validate against our own use case:

- [ ] Create partner signup page on edgeiqlabs.com
- [ ] Generate tracking links for $29 and $49 plans
- [ ] Verify `client_reference_id` passes through buy.stripe.com to webhook
- [ ] Confirm recurring invoice.paid webhooks credit ongoing commissions
- [ ] Test partner dashboard with real conversion data
- [ ] Validate Docker Compose deploys cleanly on Proxmox VM
- [ ] Test CF Workers deployment path
- [ ] Write internal runbook for approving partners and processing payouts
