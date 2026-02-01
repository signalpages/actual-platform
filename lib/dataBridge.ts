import { Asset, AuditResult, Category, ComparisonResult, ProductCategory, VerificationStatus } from '../types';
import seedDataRaw from '../seed.products';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  isSupabaseConfigured, 
  supabaseFetchAll, 
  supabaseFetchBySlug, 
  supabaseCreateAsset, 
  supabaseSaveAudit, 
  supabaseFetchAuditByAsset 
} from '../services/supabaseService';

// Safe environment variable access for Astro/Vite/Cloudflare
export const getEnv = (key: string) => {
  // @ts-ignore
  const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  // @ts-ignore
  const procEnv = typeof process !== 'undefined' ? process.env : {};
  
  if (key === 'API_KEY') {
    return procEnv.GOOGLE_AI_STUDIO_KEY || procEnv.API_KEY || viteEnv.VITE_GOOGLE_AI_STUDIO_KEY || viteEnv.VITE_API_KEY;
  }

  if (key === 'SUPABASE_URL') {
    return procEnv.SUPABASE_URL || viteEnv.VITE_SUPABASE_URL || procEnv.PUBLIC_SUPABASE_URL;
  }

  if (key === 'SUPABASE_ANON_KEY') {
    return procEnv.SUPABASE_ANON_KEY || viteEnv.VITE_SUPABASE_ANON_KEY || procEnv.PUBLIC_SUPABASE_ANON_KEY;
  }
  
  return viteEnv[`VITE_${key}`] || procEnv[key];
};

const getAI = () => {
  const currentKey = getEnv('API_KEY');
  if (!currentKey) {
    console.warn("Gemini API Key missing. Ensure GOOGLE_AI_STUDIO_KEY is set in Cloudflare.");
    return null;
  }
  return new GoogleGenAI({ apiKey: currentKey });
};

const CATEGORIES: Category[] = [
  { id: 'portable_power_station', label: 'Portable Power Station' },
  { id: 'battery', label: 'Home Battery / LFP' },
  { id: 'solar_panel', label: 'Solar Panel' },
  { id: 'inverter', label: 'Solar Inverter' },
  { id: 'solar_generator_kit', label: 'Solar Generator Kit' },
  { id: 'charge_controller', label: 'Charge Controller' }
];

const BLOCKED_TERMS = ['airpods', 'iphone', 'ipad', 'ps5', 'xbox', 'cybertruck', 'macbook', 'shoes', 'watch', 'nike', 'pixel'];

export const TOP_ENERGY_BRANDS = [
  'ECOFLOW', 'BLUETTI', 'JACKERY', 'ANKER', 'ZENDURE', 'GOAL ZERO', 'PECRON', 'VTOMAN', 
  'OUKITEL', 'FOSSIBOT', 'BOUGERV', 'RENOGY', 'VICTRON', 'GROWATT', 'EG4', 'SIGNATURE SOLAR', 
  'TESLA', 'ENPHASE', 'SOLAREDGE', 'SUNGROW', 'HUAWEI', 'SMA', 'FRONIUS', 'BYD', 'PYLONTECH',
  'LION ENERGY', 'ALLPOWERS', 'MANGO POWER', 'DURACELL', 'DEWALT', 'MILWAUKEE', 'RYOBI',
  'YETI', 'LIPERT', 'BATTLE BORN', 'SANTAN', 'RICH SOLAR', 'NEWPOWA', 'HQST', 'MIDNITE SOLAR',
  'MORNINGSTAR', 'OUTBACK POWER', 'SCHNEIDER ELECTRIC', 'MAGNUM', 'XANTREX', 'RELION',
  'BIGBATTERY', 'EG4 ELECTRONICS', 'TROJAN', 'CANADIAN SOLAR', 'JINKO', 'TRINA'
];

export const normalizeSlug = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const getAuditStore = (): Record<string, AuditResult> => {
  if (typeof sessionStorage === 'undefined') return {};
  const stored = sessionStorage.getItem('actual_fyi_audits');
  return stored ? JSON.parse(stored) : {};
};

const saveAuditLocal = (slug: string, result: AuditResult) => {
  if (typeof sessionStorage === 'undefined') return;
  const store = getAuditStore();
  store[slug.toLowerCase()] = result;
  sessionStorage.setItem('actual_fyi_audits', JSON.stringify(store));
};

export const listCategories = (): Category[] => CATEGORIES;

export const getAllAssets = async (): Promise<Asset[]> => {
  let dbAssets: Asset[] = [];
  
  if (isSupabaseConfigured) {
    try {
      dbAssets = await supabaseFetchAll();
    } catch (e) {
      console.error("Supabase fetch failed", e);
    }
  }
  
  const staticAssets: Asset[] = (seedDataRaw as any[]).map(d => {
    const isAudited = d.is_audited === true;
    return {
      ...d,
      id: d.id || Math.random().toString(36).substr(2, 9),
      category: d.category as ProductCategory,
      slug: d.slug || normalizeSlug(d.signature || `${d.brand}-${d.model_name}`),
      is_audited: isAudited,
      verified: isAudited,
      verification_status: isAudited ? 'verified' : 'provisional',
      signature: d.signature || `${d.brand}-${d.model_name}`.toUpperCase()
    };
  });
  
  let provisionalAssets = [];
  if (typeof sessionStorage !== 'undefined') {
    const stored = sessionStorage.getItem('actual_fyi_provisional');
    provisionalAssets = stored ? JSON.parse(stored) : [];
  }

  const all = [...dbAssets];
  const seenSlugs = new Set(all.map(a => a.slug));

  staticAssets.forEach(sa => {
    if (!seenSlugs.has(sa.slug)) {
      all.push(sa);
      seenSlugs.add(sa.slug);
    }
  });

  provisionalAssets.forEach((pa: Asset) => {
    if (!seenSlugs.has(pa.slug)) {
      all.push(pa);
    }
  });

  return all;
};

export const searchAssets = async (query: string, category?: string, statusFilter?: 'verified' | 'provisional' | 'all'): Promise<Asset[]> => {
  const all = await getAllAssets();
  const q = query.toLowerCase().trim();
  
  return all.filter(a => {
    const matchesCategory = !category || category === 'all' || a.category === category;
    const matchesQuery = a.brand.toLowerCase().includes(q) || a.model_name.toLowerCase().includes(q) || a.slug.includes(normalizeSlug(q));
    const matchesStatus = !statusFilter || statusFilter === 'all' || a.verification_status === statusFilter;
    return matchesCategory && matchesQuery && matchesStatus;
  });
};

export const getAssetBySlug = async (slug: string): Promise<Asset | null> => {
  const normalized = normalizeSlug(slug);
  if (isSupabaseConfigured) {
    const remote = await supabaseFetchBySlug(normalized);
    if (remote) return remote;
  }
  const all = await getAllAssets();
  return all.find(a => a.slug === normalized) || null;
};

export const createProvisionalAsset = async (input: { query: string; category: ProductCategory }): Promise<{ ok: boolean, asset?: Asset, error?: string }> => {
  const qLow = input.query.toLowerCase().trim();
  if (BLOCKED_TERMS.some(t => qLow.includes(t))) {
    return { ok: false, error: "Domain Restricted: Entry outside technical scope." };
  }

  const parts = input.query.split(' ');
  const brand = parts[0] || 'Unknown';
  const model = parts.slice(1).join(' ') || 'Generic Asset';
  
  const brandUpper = brand.toUpperCase();
  const isAuthorityBrand = TOP_ENERGY_BRANDS.some(b => brandUpper.includes(b) || b.includes(brandUpper));
  
  if (!isAuthorityBrand) {
    return { ok: false, error: "Unknown Manufacturer: Entries restricted to energy sector authority list." };
  }

  const slug = normalizeSlug(`${brand} ${model}`);

  // Check if asset already exists to avoid redundant provisional entries
  const existing = await getAssetBySlug(slug);
  if (existing) return { ok: true, asset: existing };

  const newAsset: Asset = {
    id: `PROV-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    brand: brand.charAt(0).toUpperCase() + brand.slice(1),
    model_name: model,
    category: input.category,
    signature: input.query.toUpperCase(),
    slug,
    is_audited: false,
    verified: false,
    verification_status: 'provisional'
  };

  if (isSupabaseConfigured) {
    try {
      const sbAsset = await supabaseCreateAsset(newAsset);
      if (sbAsset) return { ok: true, asset: sbAsset };
    } catch (e) {
      console.warn("Could not save to Supabase.");
    }
  }

  if (typeof sessionStorage !== 'undefined') {
    const store = JSON.parse(sessionStorage.getItem('actual_fyi_provisional') || '[]');
    sessionStorage.setItem('actual_fyi_provisional', JSON.stringify([...store, newAsset]));
  }
  return { ok: true, asset: newAsset };
};

export const runAudit = async (slug: string): Promise<AuditResult> => {
  const ai = getAI();
  if (!ai) throw new Error("AI service unavailable (Check GOOGLE_AI_STUDIO_KEY)");

  const asset = await getAssetBySlug(slug);
  if (!asset) throw new Error("Asset not found");

  const normalizedSlug = normalizeSlug(slug);
  
  if (isSupabaseConfigured) {
    try {
      const existing = await supabaseFetchAuditByAsset(asset.id);
      if (existing) return existing;
    } catch (e) {}
  } else {
    const cache = getAuditStore()[normalizedSlug];
    if (cache && cache.analysis.status === 'ready') return cache;
  }

  const prompt = `LEAD FORENSIC ENGINEER AUDIT: ${asset.brand} ${asset.model_name} (${asset.category}).
  Extract claims vs real-world data from discharge tests and manuals. Return JSON: { truth_score: number, claims: [{label, value}], reality: [{label, value}], discrepancies: [{issue, description}] }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            truth_score: { type: Type.INTEGER },
            claims: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, value: { type: Type.STRING } }, required: ["label", "value"] } },
            reality: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, value: { type: Type.STRING } }, required: ["label", "value"] } },
            discrepancies: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { issue: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["issue", "description"] } },
          },
          required: ["truth_score", "claims", "reality", "discrepancies"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    const result: AuditResult = {
      assetId: asset.id,
      analysis: { status: 'ready', last_run_at: new Date().toISOString() },
      claim_profile: parsed.claims,
      reality_ledger: parsed.reality,
      discrepancies: parsed.discrepancies,
      truth_index: Math.round(parsed.truth_score)
    };

    if (isSupabaseConfigured) {
      try {
        await supabaseSaveAudit(result);
      } catch (e) {
        saveAuditLocal(normalizedSlug, result);
      }
    } else {
      saveAuditLocal(normalizedSlug, result);
    }
    
    return result;
  } catch (e) {
    return {
      assetId: asset.id,
      analysis: { status: 'failed', last_run_at: new Date().toISOString() },
      claim_profile: [], reality_ledger: [], discrepancies: [], truth_index: null
    };
  }
};