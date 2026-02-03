import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type SeedProduct = {
  id?: string;
  brand?: string;
  model_name?: string;
  category?: string;
  slug?: string;
  manual_url?: string | null;
  technical_specs?: any; // expect array of {label,value} but we'll be defensive
  signature?: string;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function ensureSpecArray(v: any): Array<{ label: string; value: string }> {
  // Column is jsonb NOT NULL in your DB right now, so never return null.
  if (Array.isArray(v)) {
    return v
      .map((s) => {
        const label = s?.label ?? s?.name ?? s?.key ?? s?.title;
        const value = s?.value ?? s?.val ?? s?.display_value ?? s?.displayValue;
        if (!label) return null;
        return {
          label: String(label),
          value: value === undefined || value === null || value === '' ? '—' : String(value),
        };
      })
      .filter(Boolean) as any;
  }

  // If something comes in as object-map, convert to [{label,value},...]
  if (v && typeof v === 'object') {
    return Object.entries(v).map(([k, val]) => ({
      label: String(k),
      value: val === undefined || val === null || val === '' ? '—' : String(val),
    }));
  }

  return [];
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const seedPath = path.join(process.cwd(), 'seed.products.json');
  if (!fs.existsSync(seedPath)) throw new Error(`Missing file: ${seedPath}`);

  const raw = fs.readFileSync(seedPath, 'utf-8');
  const parsed = JSON.parse(raw);

  const products: SeedProduct[] = Array.isArray(parsed) ? parsed : parsed?.products ?? [];
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('seed.products.json must be an array of products (or {products:[...]})');
  }

  const rows = products.map((p) => {
    const brand = (p.brand ?? '').trim();
    const model_name = (p.model_name ?? '').trim();
    const category = (p.category ?? '').trim();

    // slug + signature (useful if your DB has either)
    const slug =
      (p.slug ?? '').trim() ||
      `${slugify(brand)}-${slugify(model_name)}${category ? `-${slugify(category)}` : ''}`;

    const signature =
      (p.signature ?? '').trim() ||
      `${slugify(brand)}|${slugify(model_name)}|${slugify(category || 'unknown')}`;

    return {
      // include id only if provided; if DB generates UUID, you can omit
      ...(p.id ? { id: p.id } : {}),
      brand: brand || null,
      model_name: model_name || null,
      category: category || null,
      slug,
      signature,
      manual_url: p.manual_url ?? null,
      technical_specs: ensureSpecArray(p.technical_specs),
    };
  });

  // IMPORTANT:
  // - If you have a unique constraint on slug: use onConflict: 'slug'
  // - If you have unique on signature: use onConflict: 'signature'
  // - If you only trust id uniqueness: use onConflict: 'id' (and require ids in seed)
  const onConflict = process.env.SEED_ON_CONFLICT || 'slug';

  const { error } = await supabase
    .from('products')
    .upsert(rows as any, { onConflict });

  if (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }

  console.log(`✅ Seeded/Upserted ${rows.length} products (onConflict=${onConflict})`);
}

main().catch((e) => {
  console.error('❌ Seed script crashed:', e);
  process.exit(1);
});
