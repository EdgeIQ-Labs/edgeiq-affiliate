import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Enums
export const partnerStatusEnum = pgEnum('partner_status', ['pending', 'approved', 'suspended']);
export const eventTypeEnum = pgEnum('event_type', ['click', 'signup', 'sale']);
export const conversionStatusEnum = pgEnum('conversion_status', ['pending', 'paid']);
export const commissionTypeEnum = pgEnum('commission_type', ['percent', 'fixed']);
export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'paid']);

// Partners table
export const partners = pgTable('partners', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  referralCode: varchar('referral_code', { length: 64 }).notNull().unique(),
  status: partnerStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tracking events table
export const trackingEvents = pgTable('tracking_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  partnerId: uuid('partner_id')
    .notNull()
    .references(() => partners.id, { onDelete: 'cascade' }),
  visitorId: varchar('visitor_id', { length: 255 }).notNull(),
  eventType: eventTypeEnum('event_type').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Conversions table
export const conversions = pgTable('conversions', {
  id: uuid('id').defaultRandom().primaryKey(),
  partnerId: uuid('partner_id')
    .notNull()
    .references(() => partners.id, { onDelete: 'cascade' }),
  stripeCheckoutSessionId: varchar('stripe_checkout_session_id', { length: 255 }),
  planId: varchar('plan_id', { length: 255 }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  commissionCents: integer('commission_cents').notNull(),
  status: conversionStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Commission rules table
export const commissionRules = pgTable('commission_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: varchar('plan_id', { length: 255 }).notNull(),
  type: commissionTypeEnum('type').notNull(),
  value: numeric('value', { precision: 10, scale: 4 }).notNull(),
  active: boolean('active').default(true).notNull(),
});

// Payouts table
export const payouts = pgTable('payouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  partnerId: uuid('partner_id')
    .notNull()
    .references(() => partners.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull(),
  method: varchar('method', { length: 64 }).notNull(),
  status: payoutStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
