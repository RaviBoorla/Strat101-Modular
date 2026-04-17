-- ═══════════════════════════════════════════════════════════════════════════════
-- Strat101 — Notification Settings Table
-- Run this in the Supabase SQL Editor on BOTH staging and production
-- Safe to run multiple times
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Create the table
CREATE TABLE IF NOT EXISTS notification_settings (
  tenant_id   UUID        PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  settings    JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  TEXT
);

-- 2. Enable Row Level Security
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies before re-creating (safe to re-run)
DROP POLICY IF EXISTS "notif_settings_select" ON notification_settings;
DROP POLICY IF EXISTS "notif_settings_insert" ON notification_settings;
DROP POLICY IF EXISTS "notif_settings_update" ON notification_settings;

-- 4. SELECT — any authenticated user in the tenant can read their row
CREATE POLICY "notif_settings_select"
  ON notification_settings FOR SELECT
  USING (tenant_id = my_tenant_id());

-- 5. INSERT — authenticated users in the tenant can create their row
CREATE POLICY "notif_settings_insert"
  ON notification_settings FOR INSERT
  WITH CHECK (tenant_id = my_tenant_id());

-- 6. UPDATE — authenticated users in the tenant can update their row
CREATE POLICY "notif_settings_update"
  ON notification_settings FOR UPDATE
  USING (tenant_id = my_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — run this SELECT to confirm the table exists:
-- SELECT * FROM notification_settings LIMIT 5;
-- ═══════════════════════════════════════════════════════════════════════════════
