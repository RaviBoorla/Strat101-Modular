-- ═══════════════════════════════════════════════════════════════════════════════
-- Strat101 — Gap Features SQL
-- Run this in the Supabase SQL Editor on BOTH staging and production
-- Safe to run multiple times (uses IF NOT EXISTS / DROP CONSTRAINT IF EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RIDE_INTEL — Add Issues and Assumptions support
--
-- The ride_intel table already has: id, tenant_id, record_type, title,
-- description, status, owner, raised_by, raised_date, due_date,
-- linked_item_id, notes, risk_* fields, decision_* fields.
--
-- We add:
--   a) Allow record_type to hold 'issue' and 'assumption' values
--   b) New columns for issue-specific fields
--   c) New columns for assumption-specific fields
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove old check constraint if it only allows 'risk' and 'decision'
ALTER TABLE ride_intel DROP CONSTRAINT IF EXISTS ride_intel_record_type_check;

-- Add updated constraint allowing all four types
ALTER TABLE ride_intel
  ADD CONSTRAINT ride_intel_record_type_check
  CHECK (record_type IN ('risk', 'decision', 'issue', 'assumption'));

-- Issue-specific columns
ALTER TABLE ride_intel ADD COLUMN IF NOT EXISTS issue_priority   TEXT;
ALTER TABLE ride_intel ADD COLUMN IF NOT EXISTS issue_category   TEXT;
ALTER TABLE ride_intel ADD COLUMN IF NOT EXISTS issue_impact     TEXT;
ALTER TABLE ride_intel ADD COLUMN IF NOT EXISTS resolution       TEXT;

-- Assumption-specific columns
ALTER TABLE ride_intel ADD COLUMN IF NOT EXISTS assumption_category  TEXT;
ALTER TABLE ride_intel ADD COLUMN IF NOT EXISTS validation_approach  TEXT;
ALTER TABLE ride_intel ADD COLUMN IF NOT EXISTS validation_date      DATE;
ALTER TABLE ride_intel ADD COLUMN IF NOT EXISTS if_invalid_impact    TEXT;

-- Ensure RLS policies cover the new record types
-- (No change needed — existing policies are on tenant_id, not record_type)


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VERIFY — Check the table structure looks correct
-- ─────────────────────────────────────────────────────────────────────────────

-- Run this SELECT to confirm all columns exist:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'ride_intel'
-- ORDER BY ordinal_position;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SEED DATA (optional) — Example issue and assumption records for testing
-- Replace <your-tenant-id> with your actual tenant UUID
-- ─────────────────────────────────────────────────────────────────────────────

-- INSERT INTO ride_intel (tenant_id, record_type, title, status, owner, raised_by, raised_date, issue_priority, issue_category, notes)
-- VALUES
--   ('<your-tenant-id>', 'issue', 'Payment gateway integration timing out', 'Open', 'Dev Team', 'QA Lead', CURRENT_DATE, 'Critical', 'Technical', 'Intermittent 504 errors under load'),
--   ('<your-tenant-id>', 'issue', 'Report generation slow for large datasets', 'In Progress', 'Backend Team', 'PM', CURRENT_DATE, 'High', 'Technical', 'Taking 45+ seconds for 10k+ records'),
--   ('<your-tenant-id>', 'assumption', 'User adoption will reach 70% by end of Q2', 'Identified', 'Product Owner', 'Business Analyst', CURRENT_DATE, 'Business', null, 'Based on similar rollouts in 2024');


-- ═══════════════════════════════════════════════════════════════════════════════
-- SUMMARY OF CHANGES
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Code changes (already deployed to staging via git push):
--
-- 1. src/modules/RiDeIntel/RiDeIntel.tsx
--    - Added RiDeTabType = 'risk'|'decision'|'issue'|'assumption'
--    - Added ISSUE_STATUSES, ASSUMPTION_STATUSES, ISSUE_PRIORITIES,
--      ASSUMPTION_CATEGORIES constants
--    - Added ISSUE_STATUS_COLOR, ASSUMP_STATUS_COLOR maps
--    - Extended RiDeRecord interface with issue_* and assumption_* fields
--    - RecordForm now handles all 4 types with conditional field sections
--    - RiDeBoard, RiDeList, SummaryBar all updated for 4 types
--    - Main component tabs: ⚡ Risk | 🎯 Decision | 🔥 Issue | 💡 Assumption
--
-- 2. src/modules/WorkItems/WorkItemsView.tsx
--    - Added exportCSV() function
--    - Added "⬇ Export CSV" button above the work items table
--    - Exports: key, type, title, status, priority, health, risk, impact type,
--      owner, assigned, sponsor, business unit, progress, dates, budget, cost
--
-- 3. src/modules/Kanban/KanbanBoard.tsx
--    - Added exportKanbanCSV() function (respects current sprint/type filters)
--    - Added "⬇ CSV" button in the kanban toolbar next to Fields button
--
-- 4. src/components/DetailPanel.tsx
--    - Sprint section now always visible for task/subtask (not conditional)
--    - Acceptance Criteria always shown — displays "Not set" placeholder
--      when empty, guiding user to edit the item to fill it in
--
-- ═══════════════════════════════════════════════════════════════════════════════
