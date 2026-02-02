-- Audit Runs Table for Async Job Queue
-- Run this migration in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','running','done','error')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error TEXT,
  result_shadow_spec_id UUID REFERENCES shadow_specs(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_product ON audit_runs(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_runs_status ON audit_runs(status);

-- Add unique constraint to prevent multiple active runs per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_runs_active_product 
ON audit_runs(product_id) 
WHERE status IN ('pending', 'running');
