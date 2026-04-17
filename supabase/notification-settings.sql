-- ═══════════════════════════════════════════════════════════════════════════════
-- Strat101 — Notification Settings Table
-- Run this in the Supabase SQL Editor on BOTH staging and production
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create the notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  tenant_id   UUID        PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  settings    JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  TEXT
);

-- Enable Row Level Security
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Global admin can read/write all rows (service role bypasses RLS)
-- Tenant users can read their own tenant's settings
CREATE POLICY IF NOT EXISTS "tenant_users_select_own_notif_settings"
  ON notification_settings FOR SELECT
  USING (tenant_id = my_tenant_id());

-- Only service role (global admin API calls) can insert/update
-- (Local admin panel reads via supabase client with tenant RLS — select only)

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — check the table was created:
-- SELECT * FROM notification_settings LIMIT 5;
-- ═══════════════════════════════════════════════════════════════════════════════
