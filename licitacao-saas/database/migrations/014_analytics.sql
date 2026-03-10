-- ============================================
-- Migration 014: Analytics do Portal e Admin
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  session_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created
  ON page_views (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_path
  ON page_views (path);

CREATE INDEX IF NOT EXISTS idx_page_views_session
  ON page_views (session_id);

CREATE INDEX IF NOT EXISTS idx_page_views_session_path_created
  ON page_views (session_id, path, created_at DESC);

CREATE TABLE IF NOT EXISTS portal_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT,
  filters_json JSONB DEFAULT '{}'::jsonb,
  results_count INTEGER DEFAULT 0,
  ip_hash TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE portal_searches
  ADD COLUMN IF NOT EXISTS filters_json JSONB DEFAULT '{}'::jsonb;

ALTER TABLE portal_searches
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE portal_searches
  ADD COLUMN IF NOT EXISTS results_count INTEGER DEFAULT 0;

ALTER TABLE portal_searches
  ADD COLUMN IF NOT EXISTS ip_hash TEXT;

ALTER TABLE portal_searches
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_portal_searches_created
  ON portal_searches (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_searches_query
  ON portal_searches (query);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;

COMMIT;
