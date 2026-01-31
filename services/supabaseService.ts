
import { createClient } from '@supabase/supabase-js';
import { Product, ShadowSpecs, AuditResult, Asset } from '../types';

const getEnv = (key: string) => {
  // @ts-ignore
  const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  // @ts-ignore
  const procEnv = typeof process !== 'undefined' ? process.env : {};
  return viteEnv[`VITE_${key}`] || procEnv[key];
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!(supabaseUrl && supabaseUrl.startsWith('http') && supabaseKey);

const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'placeholder'
);

export const supabaseFetchAll = async (): Promise<Asset[]> => {
  const { data, error } = await supabase.from('products').select('*');
  if (error) return [];
  return (data as Product[]).map(p => ({
    ...p,
    verified: p.is_audited,
    verification_status: p.is_audited ? 'verified' : 'provisional'
  }));
};

export const supabaseFetchBySlug = async (slug: string): Promise<Asset | null> => {
  const { data, error } = await supabase.from('products').select('*').eq('slug', slug).maybeSingle();
  if (error || !data) return null;
  const p = data as Product;
  return {
    ...p,
    verified: p.is_audited,
    verification_status: p.is_audited ? 'verified' : 'provisional'
  };
};

export const supabaseCreateAsset = async (asset: Partial<Asset>): Promise<Asset | null> => {
  const { data, error } = await supabase.from('products').insert([{
    brand: asset.brand,
    model_name: asset.model_name,
    category: asset.category,
    signature: asset.signature,
    slug: asset.slug,
    is_audited: false
  }]).select().single();
  
  if (error || !data) return null;
  const p = data as Product;
  return {
    ...p,
    verified: p.is_audited,
    verification_status: p.is_audited ? 'verified' : 'provisional'
  };
};

export const supabaseFetchAuditByAsset = async (assetId: string): Promise<AuditResult | null> => {
  const { data, error } = await supabase.from('shadow_specs').select('*').eq('product_id', assetId).maybeSingle();
  if (error || !data) return null;
  
  return {
    assetId: data.product_id,
    analysis: { status: 'ready', last_run_at: data.created_at },
    claim_profile: data.claimed_specs,
    reality_ledger: data.actual_specs,
    discrepancies: data.red_flags,
    truth_index: data.truth_score
  };
};

export const supabaseSaveAudit = async (audit: AuditResult): Promise<boolean> => {
  // Upsert into shadow_specs
  const { error: auditError } = await supabase.from('shadow_specs').upsert({
    product_id: audit.assetId,
    truth_score: audit.truth_index,
    claimed_specs: audit.claim_profile,
    actual_specs: audit.reality_ledger,
    red_flags: audit.discrepancies,
    is_verified: (audit.truth_index || 0) > 80,
    source_urls: []
  }, { onConflict: 'product_id' });
  
  if (auditError) return false;

  // Sync back to products table to mark as audited
  await supabase.from('products').update({ is_audited: true }).eq('id', audit.assetId);
  
  return true;
};

export const getSupabaseHealthReport = async () => {
  let products: any[] = [];
  let shadowSpecs: any[] = [];
  let errorState = null;
  
  if (isSupabaseConfigured) {
    const pRes = await supabase.from('products').select('id, is_audited');
    const sRes = await supabase.from('shadow_specs').select('product_id');
    products = pRes.data || [];
    shadowSpecs = sRes.data || [];
    errorState = pRes.error;
  }

  return {
    ok: !errorState && isSupabaseConfigured,
    env: { host: isSupabaseConfigured ? new URL(supabaseUrl!).hostname : 'mock', configured: isSupabaseConfigured },
    checks: {
      total_products: products.length,
      active_products: products.filter(p => p.is_audited).length,
      products_with_specs: shadowSpecs.length,
      products_without_specs: Math.max(0, products.length - shadowSpecs.length)
    },
    warnings: !isSupabaseConfigured ? ["Running in mock mode."] : []
  };
};
