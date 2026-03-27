-- ============================================
-- Migration 023: Fix current_step VARCHAR(200) → TEXT
-- ============================================
-- The VARCHAR(200) limit caused crashes when progress messages exceeded 200 chars.
-- Production error: "value too long for type character varying(200)"
-- Applied manually to production on 2026-03-27.

ALTER TABLE workflow_executions ALTER COLUMN current_step TYPE TEXT;
