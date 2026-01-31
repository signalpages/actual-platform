
import { Product, ShadowSpecs, ProductCategory, VerificationStatus } from '../types';

// Fix: Updated INITIAL_ASSETS to use 'brand' and cast as any to allow extra properties not in Product interface
const INITIAL_ASSETS: any[] = [
  { id: 'EF-D2', slug: 'ecoflow-delta-2', model_name: 'Delta 2', brand: 'EcoFlow', category: 'portable_power_station', status: 'active', verified: true, verification_status: 'verified', shadow_specs: { truth_score: 92, created_at: '1/10/2026', claimed_specs: [{label: 'Capacity', value: '1024Wh'}, {label: 'Output', value: '1800W'}, {label: 'Cycle Life', value: '3000+'}], actual_specs: [{label: 'Tested Wh', value: '942Wh'}, {label: 'Sustained Watts', value: '1790W'}] } },
  { id: 'EF-D2M', slug: 'ecoflow-delta-2-max', model_name: 'Delta 2 Max', brand: 'EcoFlow', category: 'portable_power_station', status: 'active', verified: true, verification_status: 'verified', shadow_specs: { truth_score: 94, created_at: '1/15/2026', claimed_specs: [{label: 'Capacity', value: '2048Wh'}, {label: 'Output', value: '2400W'}, {label: 'Chemistry', value: 'LFP'}], actual_specs: [{label: 'Tested Wh', value: '1988Wh'}, {label: 'Internal Rev', value: 'v2.1'}] } },
  { id: 'AK-C1000', slug: 'anker-solix-c1000', model_name: 'Solix C1000', brand: 'Anker', category: 'portable_power_station', status: 'active', verified: true, verification_status: 'verified', shadow_specs: { truth_score: 94, created_at: '1/22/2026', claimed_specs: [{label: 'Output', value: '1800W'}, {label: 'HyperFlash', value: '58 min'}], actual_specs: [{label: 'Sustained', value: '1780W'}] } },
  { id: 'BL-AC180', slug: 'bluetti-ac180', model_name: 'AC180', brand: 'Bluetti', category: 'portable_power_station', status: 'active', verified: true, verification_status: 'verified', shadow_specs: { truth_score: 93, created_at: '1/10/2026', claimed_specs: [{label: 'AC Power', value: '1800W'}], actual_specs: [{label: 'Trip point', value: '1820W'}] } },
  { id: 'TW-PW2', slug: 'tesla-powerwall-2', model_name: 'Powerwall 2', brand: 'Tesla', category: 'battery', status: 'active', verified: true, verification_status: 'verified', shadow_specs: { truth_score: 96, created_at: '2/01/2026', claimed_specs: [{label: 'Usable', value: '13.5kWh'}, {label: 'Efficiency', value: '90%'}], actual_specs: [{label: 'Measured', value: '13.4kWh'}] } },
  { id: 'EG-6000XP', slug: 'eg4-6000xp', model_name: '6000XP', brand: 'EG4', category: 'inverter', status: 'active', verified: true, verification_status: 'verified', shadow_specs: { truth_score: 95, created_at: '2/05/2026', claimed_specs: [{label: 'Rated Output', value: '6000W'}, {label: 'Max Solar', value: '8000W'}], actual_specs: [{label: 'Tested Sustained', value: '5980W'}] } }
];

const BLOCKED_TERMS = ['airpods', 'iphone', 'ipad', 'ps5', 'xbox', 'cybertruck', 'macbook', 'shoes', 'watch', 'nike', 'pixel'];
const HIGH_SIGNAL_BRANDS = ['TESLA', 'POWERWALL', 'ECOFLOW', 'DELTA', 'BLUETTI', 'ANKER', 'SOLIX', 'JACKERY', 'EXPLORER', 'YETI', 'EG4', '6000XP', 'MANGO'];

/**
 * Shared normalization logic
 */
export const normalizeSlug = (mfr: string, model: string = "") => {
  return `${mfr} ${model}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const evaluateSignals = (asset: Product): VerificationStatus => {
  // Fix: Use 'brand' instead of 'manufacturer'
  const mfr = asset.brand.toUpperCase();
  const mod = asset.model_name.toUpperCase();
  
  const isHighSignalBrand = HIGH_SIGNAL_BRANDS.some(brand => mfr.includes(brand) || mod.includes(brand));
  if (isHighSignalBrand) return 'verified';
  
  // Fix: Cast asset to any to access shadow_specs and use correct field names
  const shadow = (asset as any).shadow_specs;
  if (shadow && shadow.truth_score >= 90 && shadow.claimed_specs?.length) return 'verified';
  
  return 'provisional';
};

const getStorageKey = (key: string) => `actual_fyi_${key}`;

const getLedger = (): Product[] => {
  const stored = localStorage.getItem(getStorageKey('ledger'));
  if (!stored) {
    localStorage.setItem(getStorageKey('ledger'), JSON.stringify(INITIAL_ASSETS));
    return INITIAL_ASSETS;
  }
  return JSON.parse(stored);
};

const updateLedger = (ledger: Product[]) => {
  localStorage.setItem(getStorageKey('ledger'), JSON.stringify(ledger));
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const searchAssets = async (query: string, category?: string): Promise<Product[]> => {
  await sleep(400);
  const ledger = getLedger();
  const q = query.toLowerCase().trim();
  const normalizedQ = q.replace(/[^a-z0-9]+/g, '-');

  return ledger.filter(p => {
    // Fix: Use 'brand' instead of 'manufacturer'
    const matchesQuery = p.model_name.toLowerCase().includes(q) || 
                         p.brand.toLowerCase().includes(q) ||
                         p.slug.includes(normalizedQ);
    const matchesCategory = !category || p.category === category;
    return matchesQuery && matchesCategory;
  });
};

export const getAssetBySlug = async (slug: string): Promise<Product | null> => {
  await sleep(500);
  const ledger = getLedger();
  const normalized = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '');
  return ledger.find(p => p.slug === normalized) || null;
};

export const resolveOrCreateProvisional = async (data: { manufacturer: string, model: string, category: ProductCategory }): Promise<{ ok: boolean, asset?: Product, error?: string }> => {
  await sleep(1200);
  const { manufacturer, model, category } = data;
  const mfrLow = manufacturer.toLowerCase();
  const modLow = model.toLowerCase();

  if (BLOCKED_TERMS.some(term => mfrLow.includes(term) || modLow.includes(term))) {
    return { ok: false, error: 'This ledger is limited to solar + energy assets. Consumer electronics and vehicles are restricted.' };
  }

  const baseSlug = normalizeSlug(manufacturer, model);
  const ledger = getLedger();
  
  const existing = ledger.find(p => p.slug === baseSlug);
  if (existing) return { ok: true, asset: existing };

  const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
  const slug = `${baseSlug}-${shortId.toLowerCase()}`;

  // Fix: Use 'brand' instead of 'manufacturer' and cast to any for extra properties
  let newAsset: any = {
    id: `PROV-${shortId}`,
    slug,
    model_name: model,
    brand: manufacturer,
    category,
    status: 'active',
    is_audited: false,
    signature: `${manufacturer} ${model}`.toUpperCase(),
    shadow_specs: { truth_score: 0 }
  };

  newAsset.verification_status = evaluateSignals(newAsset);
  newAsset.verified = newAsset.verification_status === 'verified';

  updateLedger([...ledger, newAsset]);
  return { ok: true, asset: newAsset as Product };
};

export const runAudit = async (slug: string): Promise<ShadowSpecs> => {
  await sleep(2500);
  const ledger = getLedger();
  const index = ledger.findIndex(p => p.slug === slug);
  if (index === -1) throw new Error("Asset not found for audit");

  const product = ledger[index];
  
  const score = Math.floor(Math.random() * 20) + 75;
  // Fix: Align ShadowSpecs with interface in types.ts
  const audit: ShadowSpecs = {
    id: `AUDIT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    product_id: product.id,
    truth_score: score,
    created_at: new Date().toLocaleDateString(),
    claimed_specs: [
      { label: 'Advertised Capacity', value: '2048Wh' },
      { label: 'AC Constant Output', value: '2000W' },
      { label: 'Advertised Efficiency', value: '98%' },
      { label: 'Thermal Window', value: '-20C to 45C' }
    ],
    actual_specs: [
      { label: 'Observed Capacity', value: '1942Wh' },
      { label: 'Observed Efficiency', value: `${score - 3}%` },
      { label: 'Thermal Cut-off', value: '42.5C (measured)' }
    ],
    red_flags: [
      { issue: 'Thermal Management', description: 'Early thermal throttling observed under 80% sustained load.' }
    ],
    source_urls: [],
    is_verified: score > 90
  };

  const updatedLedger = [...ledger];
  // Fix: Use cast to any to allow shadow_specs, verification_status, verified
  const updatedProduct: any = { ...product, shadow_specs: audit };
  
  updatedProduct.verification_status = evaluateSignals(updatedProduct);
  updatedProduct.verified = updatedProduct.verification_status === 'verified';
  
  updatedLedger[index] = updatedProduct;
  updateLedger(updatedLedger);

  return audit;
};
