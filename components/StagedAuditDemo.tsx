'use client';

import { useMemo } from 'react';
import { Asset, AuditResult } from '@/types';
import { ComparisonButton } from './ComparisonButton';
import { StickyCompareButton } from './StickyCompareButton';
import { StageCard } from './StageCard';

interface StagedAuditDemoProps {
  product: Asset;
  audit?: AuditResult | null;
}

type StageMap = Record<
  string,
  { status?: string; data?: any; completed_at?: string; ttl_days?: number }
>;

function safeArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function fmtDate(d?: string | number) {
  try {
    return new Date(d || Date.now()).toLocaleDateString();
  } catch {
    return '—';
  }
}

// Bring back the "old" canonical profile rows.
// These labels should match what you used before (and what your data expects).
const CANONICAL_CLAIM_PROFILE = [
  'Storage Capacity',
  'Continuous AC Output',
  'Peak Surge Output',
  'Cell Chemistry',
  'Cycle Life Rating',
  'AC Charging Speed',
  'Solar Input (Max)',
  'UPS/EPS Protocol',
  'Expansion Capacity',
  'Thermal Operating Range',
];

export function StagedAuditDemo({ product, audit }: StagedAuditDemoProps) {
  const stages: StageMap = (audit as any)?.stages || {};
  const stage1 = stages?.stage_1;
  const stage2 = stages?.stage_2;
  const stage3 = stages?.stage_3;
  const stage4 = stages?.stage_4;

  const stageStatus = (k: string) => (stages?.[k]?.status as string) || 'pending';

  // -------------------------
  // STAGE 1: Claims snapshot
  // -------------------------
  const claimProfile = useMemo(() => {
    // Identity rows always present
    const identity = [
      { label: 'Brand', value: product?.brand ?? '—' },
      { label: 'Model', value: (product as any)?.model_name ?? (product as any)?.model ?? '—' },
      { label: 'Category', value: product?.category ?? '—' },
    ];

    // Build a lookup from product technical_specs (most stable source for the "old" view)
    const ts = safeArray((product as any)?.technical_specs);
    const specMap = new Map<string, string>();
    ts.forEach((s: any) => {
      const k = String((s?.label || s?.name || '')).trim();
      if (!k) return;
      specMap.set(k, String(s?.value ?? '—'));
    });

    // If stage/audit has extra claim rows beyond identity, include as fallback sources
    const stageClaims = safeArray(stage1?.data?.claim_profile);
    const auditClaims = safeArray((audit as any)?.claim_profile);
    const extras = [...stageClaims, ...auditClaims]
      .filter((r: any) => r?.label && !['Brand', 'Model', 'Category'].includes(r.label))
      .map((r: any) => ({ label: r.label, value: r.value ?? '—' }));

    const extraMap = new Map<string, string>();
    extras.forEach((r: any) => extraMap.set(String(r.label), String(r.value ?? '—')));

    // Canonical rows (fills from product specs first, then extras, else —)
    const canonical = CANONICAL_CLAIM_PROFILE.map((label) => ({
      label,
      value: specMap.get(label) ?? extraMap.get(label) ?? '—',
    }));

    return [...identity, ...canonical];
  }, [product, audit, stage1]);

  const realityLedger = useMemo(() => {
    // Prefer audit.reality_ledger (currently often empty)
    const fromAudit = safeArray((audit as any)?.reality_ledger);
    if (fromAudit.length) return fromAudit;

    // Support stage1 reality ledger if present
    const fromStage = safeArray(stage1?.data?.reality_ledger);
    return fromStage;
  }, [audit, stage1]);

  // -------------------------
  // STAGE 2: Independent signal
  // -------------------------
  const independentSignal = useMemo(() => {
    const data = stage2?.data || {};
    const sig = data.independent_signal || data;
    return {
      mostPraised: safeArray(sig?.most_praised),
      mostIssues: safeArray(sig?.most_reported_issues),
    };
  }, [stage2]);

  // -------------------------
  // STAGE 3: Discrepancies (tolerant to shape drift)
  // Supports:
  // - stage_3.data.red_flags
  // - stage_3.data.discrepancies
  // - audit.discrepancies (legacy / fallback)
  // -------------------------
  const discrepancies = useMemo(() => {
    const data = stage3?.data || {};
    return safeArray(
      data?.red_flags ??
      data?.discrepancies ??
      (audit as any)?.discrepancies ??
      []
    );
  }, [stage3, audit]);



  // -------------------------
  // STAGE 4: Verdict
  // -------------------------
  const verdict = useMemo(() => {
    const data = stage4?.data || {};
    return {
      truthIndex: data?.truth_index ?? (audit as any)?.truth_index ?? null,
      metricBars: safeArray(data?.metric_bars ?? (audit as any)?.metric_bars),
      scoreInterpretation: data?.score_interpretation ?? (audit as any)?.score_interpretation ?? '',
      strengths: safeArray(data?.strengths ?? (audit as any)?.strengths),
      limitations: safeArray(data?.limitations ?? (audit as any)?.limitations),
      practicalImpact: safeArray(data?.practical_impact ?? (audit as any)?.practical_impact),
      goodFit: safeArray(data?.good_fit ?? (audit as any)?.good_fit),
      considerAlternatives: safeArray(data?.consider_alternatives ?? (audit as any)?.consider_alternatives),
      dataConfidence: data?.data_confidence ?? (audit as any)?.data_confidence ?? '',
    };
  }, [audit, stage4]);

  const stage4Done = stageStatus('stage_4') === 'done';

  return (
    <div className="space-y-6 relative">
      {/* Top Comparison CTA */}
      <div className="mb-8">
        <ComparisonButton variant="primary" productSlug={product.slug} />
      </div>

      {/* Sticky CTA */}
      <StickyCompareButton
        productSlug={product.slug}
        category={product.category}
        brand={product.brand}
      />

      {/* ---------------- STAGE 1 ---------------- */}
      <StageCard
        stageNumber={1}
        title="Claim Profile"
        status={stageStatus('stage_1') === 'done' || claimProfile.length ? 'done' : 'pending'}
        description="Manufacturer claims (canonical profile). Reality ledger fills as evidence arrives."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manufacturer claims */}
          <div>
            <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3">
              Manufacturer claims
            </div>
            <div className="space-y-4">
              {claimProfile.length ? (
                claimProfile.map((row: any, idx: number) => (
                  <div key={idx}>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                      {row?.label ?? '—'}
                    </div>
                    <div className="text-lg font-extrabold text-slate-900">
                      {row?.value ?? '—'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">Waiting for claim snapshot…</div>
              )}
            </div>
          </div>

          {/* Reality ledger */}
          <div className="rounded-xl bg-slate-50 p-5">
            <div className="text-xs font-extrabold uppercase tracking-widest text-blue-600 mb-3">
              Reality ledger
            </div>

            {realityLedger.length ? (
              <div className="space-y-4">
                {realityLedger.map((row: any, idx: number) => (
                  <div key={idx}>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                      {row?.label ?? '—'}
                    </div>
                    <div className="text-lg font-extrabold text-blue-700">
                      {row?.value ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">
                No reality measurements yet — fills after independent tests & evidence reconciliation.
              </div>
            )}
          </div>
        </div>
      </StageCard>

      {/* ---------------- STAGE 2 ---------------- */}
      <StageCard
        stageNumber={2}
        title="Independent Signal"
        status={stageStatus('stage_2')}
        description="Aggregated from independent long-term usage sources"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <div className="text-emerald-700 font-black uppercase">Most consistent praise</div>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              {independentSignal.mostPraised.length ? (
                independentSignal.mostPraised.map((p: any, idx: number) => (
                  <li key={idx} className="text-slate-700">
                    {typeof p === 'string' ? p : p?.text}
                    {p?.sources ? <span className="text-slate-400"> ({p.sources})</span> : null}
                  </li>
                ))
              ) : (
                <li className="text-slate-400">Waiting for independent signal…</li>
              )}
            </ul>
          </div>

          <div>
            <div className="text-red-600 font-black uppercase">Most reported issues</div>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              {independentSignal.mostIssues.length ? (
                independentSignal.mostIssues.map((p: any, idx: number) => (
                  <li key={idx} className="text-slate-700">
                    {typeof p === 'string' ? p : p?.text}
                    {p?.sources ? <span className="text-slate-400"> ({p.sources})</span> : null}
                  </li>
                ))
              ) : (
                <li className="text-slate-400">Waiting for issue signals…</li>
              )}
            </ul>
          </div>
        </div>
      </StageCard>

      {/* ---------------- STAGE 3 ---------------- */}
      <StageCard
        stageNumber={3}
        title="Forensic Discrepancies"
        status={stageStatus('stage_3')}
        description="Cross-referencing claims with observed reality"
      >
        {discrepancies.length ? (
          <div className="divide-y">
            {discrepancies.map((rf: any, idx: number) => {
              const claimText = rf?.claim ?? rf?.issue ?? '—';
              const realityText = rf?.reality ?? rf?.description ?? '—';
              const impactText = rf?.impact ?? null;
              const severity = rf?.severity ?? null;

              return (
                <div key={idx} className="py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Claim</div>
                    <div className="text-base font-extrabold text-slate-900 mt-1">{claimText}</div>
                    {impactText ? <div className="text-sm text-slate-600 mt-2">{impactText}</div> : null}
                  </div>
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Reality</div>
                    <div className="text-base font-extrabold text-blue-700 mt-1">{realityText}</div>
                    {severity ? (
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-2">
                        Severity: {severity}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-400">Waiting for discrepancy extraction…</div>
        )}
      </StageCard>

      {/* ---------------- STAGE 4 ---------------- */}
      <StageCard
        stageNumber={4}
        title="Verdict & Truth Index"
        status={stageStatus('stage_4')}
        description="Computed from evidence convergence across stages"
      >
        {!stage4Done ? (
          <div className="text-sm text-slate-400">
            Verdict is still synthesizing — showing stage snapshots above.
          </div>
        ) : (
          <div>
            <div className="text-center py-6">
              <div className="text-6xl font-black text-blue-600 leading-none">
                {typeof verdict.truthIndex === 'number' ? verdict.truthIndex : '—'}
              </div>
              <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mt-2">
                Truth Index
              </div>
            </div>

            {verdict.metricBars.length ? (
              <div className="space-y-3">
                {verdict.metricBars.map((m: any, idx: number) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-widest text-slate-500">
                      <span>{m?.label ?? '—'}</span>
                      <span>{m?.rating ?? ''}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 mt-2 overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${Math.max(0, Math.min(100, Number(m?.percentage ?? 0)))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {verdict.scoreInterpretation ? (
              <div className="mt-6">
                <div className="text-sm font-black uppercase text-slate-700">What this score means</div>
                <div className="text-slate-700 mt-2">{verdict.scoreInterpretation}</div>
              </div>
            ) : null}

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="text-sm font-black uppercase text-slate-700">Score drivers</div>
                <ul className="mt-3 space-y-2">
                  {verdict.strengths.map((s: string, idx: number) => (
                    <li key={idx} className="text-slate-700">✓ {s}</li>
                  ))}
                  {verdict.limitations.map((s: string, idx: number) => (
                    <li key={idx} className="text-slate-700">⚠ {s}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-sm font-black uppercase text-slate-700">What this means in practice</div>
                <ul className="mt-3 space-y-2 list-disc pl-5 text-slate-700">
                  {verdict.practicalImpact.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="text-sm font-black uppercase text-slate-700">Good fit if you value</div>
                <ul className="mt-3 space-y-2 list-disc pl-5 text-slate-700">
                  {verdict.goodFit.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-sm font-black uppercase text-slate-700">Consider alternatives if you need</div>
                <ul className="mt-3 space-y-2 list-disc pl-5 text-slate-700">
                  {verdict.considerAlternatives.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            {verdict.dataConfidence ? (
              <div className="text-center pt-8 text-xs text-slate-400">
                {verdict.dataConfidence}
              </div>
            ) : null}
          </div>
        )}
      </StageCard>

      <div className="text-center pt-8 text-xs text-slate-400">
        <p>Audit Ledger ID: {(audit as any)?.assetId || '---'}</p>
        <p className="mt-1">Snapshot: {fmtDate((audit as any)?.analysis?.last_run_at)}</p>
      </div>
    </div>
  );
}
