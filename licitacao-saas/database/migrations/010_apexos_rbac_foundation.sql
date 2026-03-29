-- Migration 010: Apex OS Phase 1 - Multi-tenant RBAC foundation
-- Objetivo:
-- 1) padronizar niveis de acesso com roles + memberships
-- 2) manter compatibilidade com users.role existente
-- 3) reforcar segregacao por tenant no nivel do schema

-- ============================================================
-- 0. Extensao leve da tabela tenants
-- ============================================================

ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL
     AND to_regclass('public.idx_tenants_slug_unique') IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM tenants
      WHERE slug IS NOT NULL
      GROUP BY LOWER(slug)
      HAVING COUNT(*) > 1
    ) THEN
      RAISE NOTICE 'idx_tenants_slug_unique nao criado por slugs duplicados em tenants';
    ELSE
      CREATE UNIQUE INDEX idx_tenants_slug_unique
        ON tenants (LOWER(slug))
        WHERE slug IS NOT NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'tenants_status_check'
     ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_status_check
      CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'));
  END IF;
END $$;

-- ============================================================
-- 1. Trigger utilitario de updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at_now()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Roles (niveis de acesso)
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  level SMALLINT NOT NULL DEFAULT 100 CHECK (level >= 0),
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_system_code
  ON roles (code)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_tenant_code
  ON roles (tenant_id, code)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_roles_tenant_active
  ON roles (tenant_id, is_active);

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at_now();

-- ============================================================
-- 3. Memberships (usuario x tenant x role)
-- ============================================================

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_status
  ON memberships (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_memberships_user
  ON memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_memberships_role
  ON memberships (role_id);

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON memberships;
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at_now();

-- ============================================================
-- 4. Regra de segregacao: role deve pertencer ao tenant
--    da membership (ou ser role global de sistema)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_validate_membership_role_scope()
RETURNS TRIGGER AS $$
DECLARE
  v_role_tenant_id UUID;
BEGIN
  SELECT tenant_id
  INTO v_role_tenant_id
  FROM roles
  WHERE id = NEW.role_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'role_id % nao encontrado', NEW.role_id;
  END IF;

  IF v_role_tenant_id IS NOT NULL AND v_role_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION
      'role_id % pertence ao tenant % e nao pode ser usado no tenant %',
      NEW.role_id,
      v_role_tenant_id,
      NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memberships_validate_role_scope ON memberships;
CREATE TRIGGER trg_memberships_validate_role_scope
  BEFORE INSERT OR UPDATE OF tenant_id, role_id
  ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_membership_role_scope();

-- ============================================================
-- 5. Seed dos roles globais padrao
-- ============================================================

WITH seed(code, name, description, level) AS (
  VALUES
    ('SUPER_ADMIN', 'Super Admin', 'Acesso total em todos os tenants', 0),
    ('ADMIN', 'Admin', 'Gerencia usuarios e configuracoes do tenant', 10),
    ('ANALYST', 'Analyst', 'Opera pipeline e analises do tenant', 20),
    ('VIEWER', 'Viewer', 'Acesso somente leitura', 30)
)
INSERT INTO roles (tenant_id, code, name, description, level, is_system, is_active)
SELECT
  NULL,
  s.code,
  s.name,
  s.description,
  s.level,
  TRUE,
  TRUE
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM roles r
  WHERE r.tenant_id IS NULL
    AND r.code = s.code
);

-- ============================================================
-- 6. Backfill inicial: cria membership principal para usuarios
--    ja existentes com base em users.role + users.tenant_id
-- ============================================================

INSERT INTO memberships (user_id, tenant_id, role_id, status, is_primary)
SELECT
  u.id AS user_id,
  u.tenant_id,
  COALESCE(r_current.id, r_viewer.id) AS role_id,
  'ACTIVE' AS status,
  TRUE AS is_primary
FROM users u
JOIN roles r_viewer
  ON r_viewer.tenant_id IS NULL
 AND r_viewer.code = 'VIEWER'
LEFT JOIN roles r_current
  ON r_current.tenant_id IS NULL
 AND r_current.code = u.role
LEFT JOIN memberships m
  ON m.user_id = u.id
 AND m.tenant_id = u.tenant_id
WHERE u.tenant_id IS NOT NULL
  AND m.id IS NULL;

-- ============================================================
-- 7. View auxiliar para consultas de RBAC no app
-- ============================================================

CREATE OR REPLACE VIEW vw_user_tenant_roles AS
SELECT
  m.user_id,
  u.email,
  m.tenant_id,
  r.id AS role_id,
  r.code AS role_code,
  r.name AS role_name,
  r.level AS role_level,
  m.status AS membership_status,
  m.is_primary,
  m.created_at AS membership_created_at,
  m.updated_at AS membership_updated_at
FROM memberships m
JOIN roles r ON r.id = m.role_id
JOIN users u ON u.id = m.user_id;

COMMENT ON TABLE roles IS 'Catalogo de niveis de acesso globais e por tenant';
COMMENT ON TABLE memberships IS 'Associacao user x tenant x role com segregacao por tenant';
COMMENT ON VIEW vw_user_tenant_roles IS 'Visao consolidada de acesso por usuario e tenant';
