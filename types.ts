
export type ProductCategory =
  | 'portable_power_station'
  | 'solar_generator_kit'
  | 'solar_panel'
  | 'inverter'
  | 'battery'
  | 'charge_controller'
  | 'home_battery'
  | 'microinverter'
  | 'optimizer'
  | 'dc_converter';

export type VerificationStatus = 'verified' | 'provisional';

export interface Category {
  id: ProductCategory;
  label: string;
}

// UI labels for categories
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  portable_power_station: 'Portable Power Station',
  solar_generator_kit: 'Solar Generator Kit',
  solar_panel: 'Solar Panel',
  inverter: 'Inverter',
  battery: 'Battery',
  charge_controller: 'Charge Controller',
  home_battery: 'Home Battery',
  microinverter: 'Microinverter',
  optimizer: 'Optimizer',
  dc_converter: 'DC Converter',
};

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
  claimed_specs: any[]; // JSONB
  actual_specs: any[]; // JSONB
  red_flags: Discrepancy[]; // JSONB
  truth_score: number;
  source_urls: string[];
  is_verified: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  stages?: AuditStages; // NEW: Progressive stage data
}

// Stage types
export type StageStatus = 'pending' | 'running' | 'done' | 'error';

export interface StageData {
  status: StageStatus;
  completed_at: string | null;
  ttl_days: number;
  data: any;
  error?: string;
}

export interface AuditStages {
  stage_1: StageData; // Claim Profile
  stage_2: StageData; // Independent Signal
  stage_3: StageData; // Forensic Discrepancies
  stage_4: StageData; // Verdict & Truth Index
}

// Audit job tracking for async queue
export interface AuditRun {
  id: string;
  product_id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  progress: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  result_shadow_spec_id: string | null;
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
  severity?: 'low' | 'med' | 'medium' | 'high';
  // Optional fields for non-English content
  source_excerpt_original?: string;  // Raw non-English text
  source_excerpt_en?: string;        // English translation
  sources?: { title?: string; url?: string }[];
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
