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
