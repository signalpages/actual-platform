
export type ProductCategory =
  | 'portable_power_station'
  | 'solar_generator_kit'
  | 'solar_panel'
  | 'inverter'
  | 'battery'
  | 'charge_controller';

export type VerificationStatus = 'verified' | 'provisional';

export interface Category {
  id: ProductCategory;
  label: string;
}

// Aligned with 'products' table in ERD
export interface Product {
  id: string;
  sku?: string;
  slug: string;
  category: ProductCategory;
  brand: string;
  model_name: string;
  affiliate_link?: string;
  created_at?: string;
  technical_specs?: any; // JSONB
  manual_url?: string;
  weight_lbs?: number;
  release_date?: string;
  msrp_usd?: number;
  tags?: string[];
  is_audited: boolean;
  signature: string;
}

// Aligned with 'shadow_specs' table in ERD
export interface ShadowSpecs {
  id: string;
  product_id: string;
  claimed_specs: any; // JSONB
  actual_specs: any; // JSONB
  red_flags: any; // JSONB
  truth_score: number;
  source_urls: string[];
  is_verified: boolean;
  created_at: string;
}

// Legacy bridge type for internal logic consistency
export interface Asset extends Product {
  verified: boolean;
  verification_status: VerificationStatus;
}

export interface AuditItem {
  label: string;
  value: string;
}

export interface Discrepancy {
  issue: string;
  description: string;
}

export interface AuditResult {
  assetId: string;
  analysis: {
    status: 'identified' | 'analyzing' | 'ready' | 'provisional' | 'failed';
    last_run_at: string | null;
  };
  claim_profile: AuditItem[];
  reality_ledger: AuditItem[];
  discrepancies: Discrepancy[];
  truth_index: number | null;
}

export interface ComparisonResult {
  a: AuditResult;
  b: AuditResult;
}
