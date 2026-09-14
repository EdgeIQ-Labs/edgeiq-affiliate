# Relay Deployment Guide

## Prerequisites
- Docker and Docker Compose v2+
- A `.env` file (copy from `.env.example`)

## Quick Start

```bash
cp .env.example .env
# Edit .env with your real values
docker compose up -d
```

The `migrate` service runs automatically before the API starts.

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Database password |
| `SECRET_KEY` | JWT signing secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |

The API container will fail fast if any required variable is missing.

## Production Hardening Checklist

- [ ] Set strong `POSTGRES_PASSWORD` and `SECRET_KEY`
- [ ] Point `STRIPE_WEBHOOK_SECRET` to your live Stripe webhook secret
- [ ] Configure a reverse proxy (Caddy/Nginx) with TLS in front of port 3000
- [ ] Restrict Postgres port 5432 to internal network only
- [ ] Set up automated backups for the `postgres_data` volume
- [ ] Seed commission rules: `pnpm seed:edgeiq`

## Manual Migration

```bash
docker compose run --rm migrate
```

## Health Checks

- **Postgres:** `pg_isready` every 5s, 10 retries
- **API:** HTTP GET `/health` every 15s, 3 retries
