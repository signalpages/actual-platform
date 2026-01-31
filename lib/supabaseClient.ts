
import { createClient } from '@supabase/supabase-js';

/**
 * Environment variable resolution for both Vite (Client) and Cloudflare Pages (Server/CI)
 */
const getEnv = (key: string) => {
  // @ts-ignore - Handle Vite specific env
  const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  // @ts-ignore - Handle Node/Cloudflare specific env
  const procEnv = typeof process !== 'undefined' ? process.env : {};

  return (
    viteEnv[`VITE_${key}`] || 
    viteEnv[`PUBLIC_${key}`] || 
    procEnv[key] || 
    procEnv[`VITE_${key}`] || 
    procEnv[`PUBLIC_${key}`]
  );
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY');

// Verify configuration before attempting connection to avoid ERR_NAME_NOT_RESOLVED
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('placeholder') &&
  supabaseKey && 
  supabaseKey !== 'placeholder-key'
);

// Initialization with safe fallback
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://actual-fyi-placeholder.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'placeholder-key'
);

if (isSupabaseConfigured) {
  try {
    const url = new URL(supabaseUrl);
    console.log(`[Supabase] Routing to node: ${url.hostname}`);
  } catch (e) {}
}
