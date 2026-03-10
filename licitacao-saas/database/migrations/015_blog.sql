CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  cover_prompt TEXT,
  author TEXT DEFAULT 'LicitaIA',
  status TEXT DEFAULT 'draft',
  seo_title TEXT,
  seo_description TEXT,
  read_time_minutes INTEGER DEFAULT 5,
  view_count INTEGER DEFAULT 0,
  lead_count INTEGER DEFAULT 0,
  generated_by TEXT DEFAULT 'ai',
  source_query TEXT,
  source_data JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published_at DESC) WHERE status = 'published';
