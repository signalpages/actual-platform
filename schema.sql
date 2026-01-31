
-- Actual.fyi Production Ledger Schema (ERD Version)

-- 1. Products Table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  model_name TEXT NOT NULL,
  affiliate_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  technical_specs JSONB DEFAULT '{}',
  manual_url TEXT,
  weight_lbs NUMERIC,
  release_date DATE,
  msrp_usd NUMERIC,
  tags TEXT[] DEFAULT '{}',
  is_audited BOOLEAN DEFAULT false,
  signature TEXT NOT NULL
);

-- 2. Shadow Specs Table (Forensic Layer)
CREATE TABLE shadow_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  claimed_specs JSONB DEFAULT '[]',
  actual_specs JSONB DEFAULT '[]',
  red_flags JSONB DEFAULT '[]',
  truth_score NUMERIC,
  source_urls TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Optimization Indexes
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_shadow_product ON shadow_specs(product_id);

-- 4. Initial Seed Function (Example)
-- To seed: 
-- INSERT INTO products (slug, category, brand, model_name, is_audited, signature) 
-- VALUES ('ecoflow-delta-2', 'portable_power_station', 'EcoFlow', 'Delta 2', true, 'ECOFLOW-DELTA-2');
