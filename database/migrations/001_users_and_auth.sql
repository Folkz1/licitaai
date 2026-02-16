-- Migration 001: Users, Plans, Subscriptions, Review Actions
-- Run against: postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution

-- 1. Users table for NextAuth credentials
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'ANALYST', 'VIEWER')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Plans
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  max_licitacoes_per_month INT NOT NULL DEFAULT 50,
  max_users INT NOT NULL DEFAULT 2,
  max_searches_per_day INT NOT NULL DEFAULT 3,
  features JSONB DEFAULT '{}',
  price_monthly_cents INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default plans
INSERT INTO plans (name, display_name, max_licitacoes_per_month, max_users, max_searches_per_day, price_monthly_cents) VALUES
  ('starter', 'Starter', 100, 2, 5, 19700),
  ('pro', 'Pro', 500, 5, 20, 39700),
  ('enterprise', 'Enterprise', 999999, 50, 999, 99700)
ON CONFLICT (name) DO NOTHING;

-- 3. Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIAL', 'SUSPENDED')),
  notes TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Review Actions (human workflow history)
CREATE TABLE IF NOT EXISTS review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN (
    'ADVANCE', 'REJECT', 'NOTE', 'ASSIGN', 'PARTICIPATE', 'REQUEST_INFO', 'REOPEN'
  )),
  from_phase TEXT,
  to_phase TEXT,
  note TEXT,
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_actions_licitacao ON review_actions(licitacao_id);
CREATE INDEX IF NOT EXISTS idx_review_actions_tenant ON review_actions(tenant_id);

-- 5. Add review columns to licitacoes (if not exist)
DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN review_phase TEXT DEFAULT 'NOVA';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN assigned_to UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN priority_override TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE licitacoes ADD COLUMN review_notes TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Add onboarding columns to tenants
DO $$ BEGIN
  ALTER TABLE tenants ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE tenants ADD COLUMN ai_config JSONB DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
