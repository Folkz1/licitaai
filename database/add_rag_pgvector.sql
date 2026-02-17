-- Enable RAG storage with pgvector (Postgres)
-- Creates a generic vector table compatible with n8n PGVector examples (project_knowledge_base).

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Vector store table
CREATE TABLE IF NOT EXISTS public.project_knowledge_base (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_project_knowledge_base_tenant_project
  ON public.project_knowledge_base (tenant_id, project_id);

CREATE INDEX IF NOT EXISTS idx_project_knowledge_base_metadata_gin
  ON public.project_knowledge_base USING gin (metadata);

-- pgvector 0.8+ supports HNSW indexes
CREATE INDEX IF NOT EXISTS idx_project_knowledge_base_embedding_hnsw
  ON public.project_knowledge_base USING hnsw (embedding vector_cosine_ops);

