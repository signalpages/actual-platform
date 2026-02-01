export const runtime = 'edge';

export async function GET() {
  return Response.json({
    environment: 'cloudflare-pages',
    timestamp: new Date().toISOString(),
    envCheck: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasGoogleKey: !!process.env.GOOGLE_AI_STUDIO_KEY,
      hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasPublicKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      // Show partial values (first 10 chars) to confirm they're set
      supabaseUrlPrefix: process.env.SUPABASE_URL?.substring(0, 20) || 'MISSING',
      publicUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) || 'MISSING',
    }
  });
}
