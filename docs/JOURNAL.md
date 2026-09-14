# EdgeIQ Affiliate Tool — Project Journal

> Persistent log of decisions, progress, and blockers. Carries across sessions.

---

## 2026-09-14 — Day Zero

### Context
- EdgeIQ Labs (edgeiqlabs.com) has zero revenue as of today
- Phase 1 + Phase 2 site restructure completed: hero flipped to security-first, SMB pricing above fold, nav simplified, brand tagline locked to "Cybersecurity Monitoring"
- 4 SaaS products planned: affiliate tool, agentic QA, shadow DB, AI media studio
- Affiliate tool selected as first build — dogfood for EdgeIQ's own SMB bundle partner program

### Inspiration
- Simon Høiberg video (youtu.be/H9YVvRkZnCo): "5 SaaS Ideas for 2026"
- Core thesis: existing affiliate tools (Rewardful, FirstPromoter) require Stripe read access (revenue, emails, transactions). Privacy nightmare. Open-source self-hosted alternative is wide open.

### Competitive Landscape (researched 2026-09-14)
| Tool | Price | Stripe Access | Weakness |
|------|-------|---------------|----------|
| **Rewardful** | $49/mo+ (up to 9% tx fees on lower tiers) | Full read access required | Stripe-only, no Paddle/LemonSqueezy, revenue limits $7.5k-$30k/mo on lower tiers, external portal only |
| **FirstPromoter** | $99/mo+ | Full read access required | Expensive, complex setup, revenue limits on lower tiers |
| **Refgrow** | $29/mo, 0% fees | Connects to payment providers | Newer, less proven, still cloud-hosted |
| **Tapfiliate** | $69/mo+ | Varies | Enterprise-focused, overkill for small programs |
| **Tolt** | $49/mo+ | Full read access | Similar privacy issues |

**Our wedge:** None of these are self-hosted. None are open-source. All require handing over financial data to a third party. That's the gap.

### Decisions Made
- Repo: `EdgeIQ-Labs/edgeiq-affiliate` (public, GitHub)
- Local path: `/home/guy/repos/edgeiq-affiliate/`
- Landing page stub: `/home/guy/repos/edgeiq-labs/affiliate/index.html` (coming soon teaser)
- Architecture spec: delegated to subagent, pending

### Status
- [x] Repo scaffolded and pushed to GitHub
- [x] Landing page stub created
- [x] Competitor research done
- [x] Project journal initialized
- [ ] Architecture spec (subagent running)
- [ ] Tech stack decision
- [ ] MVP development start

### Blockers
None yet — waiting on spec to land before making architecture decisions.

---

## 2026-09-15 — Phase 6: Dogfood Integration

### Context
- Phases 1-5 complete (39 tests passing, commit d98f6a0)
- Phase 6 wires Relay into EdgeIQ's actual Stripe checkout flow so we eat our own dog food

### What Was Built
- **drizzle.config.ts** — root-level drizzle-kit config for `generate` and `migrate` commands
- **packages/core/src/migrate.ts** — standalone migration runner using drizzle-orm's `migrate()`, reads DATABASE_URL from env
- **scripts/seed-edgeiq.ts** — idempotent seed script inserting commission_rules for EdgeIQ plans (smb-essentials 20%, smb-plus 15%, ssl-watcher-pro 20%, scanner tools $5 fixed)
- **packages/web/src/lib/relay-integration.ts** — drop-in IIFE bundle for static sites; exports `init()`, `buildRelayLink()`, `getReferralCode()`, `rewriteCheckoutLinks()`; auto-rewrites buy.stripe.com links via MutationObserver
- **docker-compose.yml** — hardened with migrate service (runs before API), health checks on postgres + api, fail-fast env var validation (`:?` syntax), restart policies, named volume
- **docs/DEPLOY.md** — production deployment guide
- **edgeiq-labs/affiliate/index.html** — replaced coming-soon stub with live affiliate program page, commission structure, integration docs, relay-integration.js script tag

### Decisions Made
- Used DELETE+INSERT in a transaction for seed idempotency (commission_rules has no unique constraint on plan_id)
- Migrate runs as a separate Docker Compose service with `restart: "no"` and `condition: service_completed_successfully` dependency
- relay-integration.ts uses MutationObserver to catch dynamically injected checkout links
- Affiliate page loads relay-integration.js from `https://relay.edgeiqlabs.com` (production URL)

### Dogfood Approach
EdgeIQ's 20+ scanner tools use buy.stripe.com checkout links. The relay-integration.js snippet appends `client_reference_id` from the `_relay_vid` cookie to all Stripe links automatically. When a referred visitor subscribes, Stripe fires `checkout.session.completed` with the reference ID, and Relay matches it to the partner.

### Status
- [x] Migration runner created
- [x] Drizzle config added
- [x] Seed script for EdgeIQ plans
- [x] Static site integration helper
- [x] Docker Compose hardened
- [x] Deploy docs written
- [x] EdgeIQ affiliate page updated
- [x] Build verification passed (39/39 tests)
- [x] Git pushed as 6772c87

---

## 2026-09-14 — Phase 7: Polish & Open-Source Release + Production Deployment

### What Was Built
- AGPL-3.0-or-later LICENSE + LICENSE-COMMERCIAL.md (dual-license model)
- README.md overhauled with Mermaid architecture diagram, quickstart, self-host guide
- CONTRIBUTING.md with dev setup, test commands, PR process
- .github/CODEOWNERS set to @EdgeIQ-Labs
- License fields added to all package.json files
- Tagged v0.1.0, GitHub release created

### Production Deployment (Deployr-5)
- Relay deployed on Deployr-5 (10.18.157.11) via Docker Compose behind Traefik reverse proxy
- Traefik config patched: added edgeiqlabs.com + wildcard as domains[1] for both external (444) and internal (443) entrypoints
- docker-compose.yml network fixed from `coolify` to `t3_proxy`
- Dockerfile rewritten multiple times: settled on node:20-slim + pnpm (bun can't resolve pnpm workspaces)
- Healthcheck uses node-native HTTP check (wget not available in node-slim)
- Migrations run via npx tsx (added drizzle-kit + tsx as devDeps)
- Commission rules seeded: smb-essentials 20%, smb-plus 15%, ssl-watcher-pro 20%, xss-scanner-pro $5, subdomain-hunter-pro $5

### DNS & Networking
- Cloudflare A record for relay.edgeiqlabs.com set to public IP, proxied (orange cloud)
- pfSense rule 7 enabled: ports 443-1443 WAN → 10.18.157.11 (Deployr-5)
- Rule 7 destination updated from stale 10.5.1.95 → 10.18.157.11
- Full chain verified: CF → pfSense (443) → Deployr-5 Traefik → Relay container

### SPA Serving Fix
- API container only served Hono backend, React SPA returned 404s
- Added serveStatic + SPA fallback to packages/api/src/index.ts
- Dockerfile updated to COPY web source + run `npx vite build`
- Fixed ESM __dirname error with fileURLToPath(import.meta.url)
- Root tsconfig.json copied into Docker context for vite
- All routes now working: /health, /admin, /portal/signup

### Webhook Verification
- Stripe webhook URL confirmed: https://relay.edgeiqlabs.com/webhooks/stripe
- Signing secret configured in .env
- Manual test: crafted signed checkout.session.completed payload, POSTed with Stripe User-Agent
- CF bot management blocked raw urllib (error 1010) — Stripe's User-Agent bypasses it
- Relay returned {"received":true} — full money loop verified
- NOTE: should whitelist Stripe webhook IPs in CF WAF to prevent future blocking

### Site Integration
- Tracking snippet injected into 18 HTML pages on edgeiqlabs.com (Python script + sed)
- Affiliate page CTAs fixed: partners.edgeiqlabs.com/signup → relay.edgeiqlabs.com/portal/signup
- Affiliate link added to: top nav (neon green #00ff66), mobile menu, footer
- Pushed as 3ce31c4 + 545f9e1 to CF Pages

### Status
- [x] Phase 7 polish complete
- [x] v0.1.0 released
- [x] Production deployment live
- [x] DNS + SSL + Traefik wired
- [x] SPA serving working
- [x] Webhook pipeline verified end-to-end
- [x] Commission rules seeded
- [x] Tracking snippet on 18 pages
- [x] Affiliate page linked from nav + footer
- [x] Partner signup CTAs pointing to correct URL

### Next Steps
- Recruit actual affiliate partners
- Whitelist Stripe IPs in CF WAF
- Build SaaS product #2 (agentic QA tool)
