#!/usr/bin/env node
/**
 * Seed EdgeIQ commission rules into the Relay database.
 * Idempotent: uses INSERT ... ON CONFLICT DO NOTHING via a plan_id unique constraint workaround.
 * Since commission_rules has no unique constraint on plan_id, we DELETE + INSERT in a transaction.
 *
 * Usage: bun run scripts/seed-edgeiq.ts
 */
import postgres from 'postgres';

const RULES = [
  { planId: 'smb-essentials', type: 'percent', value: '20.0000', active: true },
  { planId: 'smb-plus', type: 'percent', value: '15.0000', active: true },
  { planId: 'ssl-watcher-pro', type: 'percent', value: '20.0000', active: true },
  { planId: 'xss-scanner-pro', type: 'fixed', value: '5.0000', active: true },
  { planId: 'subdomain-hunter-pro', type: 'fixed', value: '5.0000', active: true },
];

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('Seeding EdgeIQ commission rules...');

    await sql.begin(async (tx) => {
      // Delete existing EdgeIQ rules to make this idempotent
      const planIds = RULES.map((r) => r.planId);
      await tx`DELETE FROM commission_rules WHERE plan_id IN ${sql(planIds)}`;

      for (const rule of RULES) {
        await tx`
          INSERT INTO commission_rules (id, plan_id, type, value, active)
          VALUES (gen_random_uuid(), ${rule.planId}, ${rule.type}::commission_type, ${rule.value}::numeric, ${rule.active})
        `;
      }
    });

    console.log(`Seeded ${RULES.length} commission rules successfully.`);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();
