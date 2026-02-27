"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { runAudit, getAssetBySlug } from "@/lib/dataBridge.client";
import { hasMeaningfulSpecs } from "@/lib/hasMeaningfulSpecs";
import { AssetSelector } from "@/components/ComparisonPicker";
import type { Asset, AuditResult } from "@/types";
import { CanonicalAuditResult, normalizeAuditResult } from "@/lib/auditNormalizer";
import SubmissionSuccess from "@/components/SubmissionSuccess";
import { AuditResults } from "@/components/AuditResults";
import { formatCategoryLabel } from "@/lib/categoryFormatter";

interface ProductDetailViewProps {
  initialAsset: Asset | null;
  initialAudit?: CanonicalAuditResult | null;
  slug: string;
}

export default function ProductDetailView({ initialAsset, initialAudit, slug }: ProductDetailViewProps) {
  // ---------- Hooks (MUST be unconditional, top-level) ----------
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditProcessed = useRef<string | null>(null);

  const [mounted, setMounted] = useState(false);

  const [asset, setAsset] = useState<Asset | null>(initialAsset);
  const [audit, setAudit] = useState<CanonicalAuditResult | null>(initialAudit || null);
  const [loading, setLoading] = useState(!initialAsset);

  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);

  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [hasRevealedLedger, setHasRevealedLedger] = useState(
    // Auto-reveal if SSR already delivered a complete audit
    () => typeof initialAudit?.truth_index === 'number' && initialAudit.truth_index > 0
  );

  // UX-001: Verify Integrity state
  type IntegrityState = 'idle' | 'checking' | 'done' | 'error';
  const [integrityState, setIntegrityState] = useState<IntegrityState>('idle');
  const [integrityResult, setIntegrityResult] = useState<{
    checksum?: string | null;
    lastVerifiedAt?: string | null;
    freshnessDays?: number | null;
    needsRefresh?: boolean;
    status?: string;
    truthScore?: number | null;
  } | null>(null);

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [showSubmissionFlow, setShowSubmissionFlow] = useState(false);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const shouldAutoRun = useMemo(() => searchParams.get("autoRun") === "true", [searchParams]);

  // ---------- Effects ----------
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydrate asset if initial data missing (fallback)
  useEffect(() => {
    if (!asset && slug) {
      getAssetBySlug(slug).then((data) => {
        setAsset(data);
        setLoading(false);
      });
    }
  }, [asset, slug]);

  // CACHE-001: Persist audit to session storage as a performance suggestion only.
  // DB is canonical source of truth. Session is read-only warm cache.
  useEffect(() => {
    if (!audit || !slug || !mounted) return;
    try {
      const current = JSON.parse(sessionStorage.getItem("actual_fyi_audits") || "{}");
      current[slug.toLowerCase()] = audit;
      sessionStorage.setItem("actual_fyi_audits", JSON.stringify(current));
    } catch {
      // ignore
    }
  }, [audit, slug, mounted]);

  // Load audit from session storage only after mount (client-only fallback).
  // Only hydrates if no SSR audit was provided.
  useEffect(() => {
    if (!mounted) return;
    if (!audit && slug) {
      try {
        const storedAudits = JSON.parse(sessionStorage.getItem("actual_fyi_audits") || "{}");
        const key = slug.toLowerCase();
        if (storedAudits[key]) setAudit(storedAudits[key]);
      } catch {
        // ignore bad cache
      }
    }
  }, [mounted, audit, slug]);

  const handleDeepScan = useCallback(
    async (targetAsset: Asset, forceRefresh = false) => {
      console.log('[DEBUG] handleDeepScan called', { targetAsset, isScanning: isScanningRef.current, forceRefresh });

      // We only return early if we are currently scanning.
      // Use ref to avoid stale closure trap from handleVerifyIntegrity
      if (!targetAsset || isScanningRef.current) {
        console.log('[DEBUG] handleDeepScan exiting early!', { isScanning: isScanningRef.current, hasAsset: !!targetAsset });
        return;
      }

      setIsScanning(true);
      isScanningRef.current = true;
      console.log('[DEBUG] handleDeepScan proceeding to runAudit');

      try {
        const result = await runAudit({ slug: targetAsset.slug, forceRefresh, asset: targetAsset });
        console.log('[DEBUG] runAudit returned', result);

        setAudit(result);
        // Session write handled by the dedicated useEffect above.

        if (result?.analysis?.status === "failed") {
          // Only show submission flow on a true audit failure
          setShowSubmissionFlow(true);
        } else {
          setShowSubmissionFlow(false);
          // Always reveal the ledger after a successful run —
          // regardless of whether specs existed (audit may still produce a valid result)
          setHasRevealedLedger(true);
        }
      } catch (e: any) {
        setErrorMessage(e?.message || "Audit failed. Please try again.");
        setShowErrorModal(true);
      } finally {
        setIsScanning(false);
        isScanningRef.current = false;
      }
    },
    [] // Dependencies cleanly empty since we use refs and stable external functions
  );

  // CACHE-001: Auto-run guard — only trigger LLM if no canonical data exists.
  // Priority: initialAudit (SSR) > session cache > auto-run.
  // This prevents refresh from re-triggering compute.
  useEffect(() => {
    if (!mounted) return;
    // audit here includes initialAudit (from SSR) and session cache (from earlier useEffect)
    if (asset && shouldAutoRun && auditProcessed.current !== slug && !audit) {
      auditProcessed.current = slug;
      handleDeepScan(asset);
    }
  }, [mounted, asset, shouldAutoRun, slug, audit, handleDeepScan]);

  // UX-001: Ledger retrieval — honest integrity check, no LLM unless needed.
  const handleVerifyIntegrity = useCallback(async () => {
    if (!asset?.slug || integrityState === 'checking') return;
    setIntegrityState('checking');
    const t0 = Date.now();
    try {
      const res = await fetch('/api/audit/integrity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: asset.slug }),
      });
      const data = await res.json();

      // Cinematic minimum: 600ms
      const elapsed = Date.now() - t0;
      if (elapsed < 600) await new Promise(r => setTimeout(r, 600 - elapsed));

      if (data.status === 'verified') {
        console.log('[DEBUG] handleVerifyIntegrity: Cache hit (verified)');
        setIntegrityState('idle');
        setHasRevealedLedger(true);
      } else {
        console.log('[DEBUG] handleVerifyIntegrity: No audit or partial. Calling handleDeepScan', data.status);
        setIntegrityState('idle');
        handleDeepScan(asset);
      }
    } catch (e) {
      console.error('[DEBUG] handleVerifyIntegrity: Caught error', e);
      setIntegrityState('idle');
      handleDeepScan(asset);
    }
  }, [asset, integrityState, handleDeepScan]);

  // Stage recovery: re-run a single atomic stage endpoint.
  const handleRunStage = useCallback(async (stage: 'stage2' | 'stage3' | 'stage4') => {
    if (!asset?.slug || isScanning) return;
    setIsScanning(true);
    try {
      const res = await fetch(`/api/audit/${stage}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: asset.slug }),
      });
      const data = await res.json();
      if (data.ok && data.output) {
        // Merge returned stage output into existing audit stages without overwriting others
        setAudit(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            stages: {
              ...prev.stages,
              [stage.replace('stage', 'stage_')]: { status: 'done', data: data.output }
            }
          } as CanonicalAuditResult;
        });
      }
      // Always re-fetch canonical audit from session/server after stage run
      await handleDeepScan(asset, true);
    } catch (e: any) {
      setErrorMessage(e?.message || `Stage ${stage} failed.`);
      setShowErrorModal(true);
    } finally {
      setIsScanning(false);
    }
  }, [asset, isScanning, handleDeepScan]);

  // Stage 1 is done if product has technical_specs (independent of audit).
  // CRITICAL: technical_specs is Array<{label,value}>, NOT { items:[] }.
  // Use hasMeaningfulSpecs — the single source of truth.
  const productHasSpecs = hasMeaningfulSpecs(asset?.technical_specs);
  const stage1Done = productHasSpecs;

  // COMPUTE EFFECTIVE AUDIT
  // Always normalize asset to skeleton audit if real audit is missing to ensure AuditResults can render
  const effectiveAudit = audit || (asset ? normalizeAuditResult(null, asset) : null);

  const allStagesComplete = !!(
    stage1Done &&
    effectiveAudit?.stages?.stage_2?.status === "done" &&
    effectiveAudit?.stages?.stage_3?.status === "done" &&
    effectiveAudit?.stages?.stage_4?.status === "done"
  );

  const cacheHasVerifiedAudit = stage1Done && allStagesComplete && !!effectiveAudit?.truth_index;
  const isVerifiedAudit = cacheHasVerifiedAudit && hasRevealedLedger;
  const isProvisional = asset?.verification_status === "provisional";

  const visibleAudit = useMemo(() => {
    if (!effectiveAudit) return null;

    // If the product has no real specs, hide everything downstream (stages 2–4)
    // so the user sees a clean pending state with the "Retrieve Ledger Entry" button.
    if (!productHasSpecs) {
      return {
        ...effectiveAudit,
        truth_index: null,
        stages: {
          stage_1: effectiveAudit.stages?.stage_1
        }
      } as CanonicalAuditResult;
    }

    if (hasRevealedLedger) return effectiveAudit;

    // Mask downstream stages until revealed
    return {
      ...effectiveAudit,
      truth_index: null,
      stages: {
        stage_1: effectiveAudit.stages?.stage_1
      }
    } as CanonicalAuditResult;
  }, [effectiveAudit, hasRevealedLedger, productHasSpecs]);

  // Force Layout to always show AuditResults (per user request: "all unaudited products should have the layout on the left")
  // We disable the "Missing Asset Protocol" form by ensuring noDataFound is always false if we have an asset.
  const noDataFound = false;

  let auditStatusLabel = "Verified Ledger Entry";
  if (isScanning) auditStatusLabel = "Verifying...";
  else if (isProvisional) auditStatusLabel = "Preliminary synthesis required";
  else if (!isVerifiedAudit) auditStatusLabel = "Verified Asset (Pending Full Audit)";

  const truthColor = isVerifiedAudit
    ? (audit?.truth_index || 0) >= 90
      ? "text-emerald-500"
      : "text-blue-600"
    : "text-slate-300";

  // ---------- Render ----------
  // IMPORTANT: We only branch returns AFTER all hooks have executed.

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Loading Asset Data...
        </p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <div className="bg-white border border-slate-200 p-12 rounded-3xl shadow-sm">
          <h2 className="text-2xl font-black uppercase mb-4 tracking-tighter text-slate-900">
            Asset Not Located
          </h2>
          <p className="text-slate-500 mb-8 text-sm italic">
            The product signature "{slug}" could not be resolved in the current session.
          </p>
          <Link
            href="/"
            className="inline-block bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-5xl mx-auto px-6 py-12 relative">
      {/* Dev Debug Badge */}
      {process.env.NODE_ENV === 'development' && effectiveAudit && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-white p-3 rounded-lg text-[10px] font-mono shadow-xl border border-slate-700">
          <div className="font-bold text-emerald-400 mb-1">DEBUG: Audit Schema</div>
          <div>Source: <span className="text-yellow-300">{effectiveAudit._schema_source || 'unknown'}</span></div>
          <div>HasSpecs: {productHasSpecs ? 'yes' : 'no'}</div>
          <div>Ledger: {effectiveAudit.reality_ledger?.length || 0}</div>
          <div>Truth: {effectiveAudit.truth_index ?? 'null'}</div>
        </div>
      )}

      {/* Scanning overlay — shown during full audit run (can take 30-60s) */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-white/85 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-900">Running verification</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Analyzing claims across 4 stages…</p>
            </div>
          </div>
        </div>
      )}
      {/* UX-001: Cinematic overlay while checking integrity (fast path) */}
      {integrityState === 'checking' && (
        <div className="fixed inset-0 z-[100] bg-white/85 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-900">Retrieving ledger entry</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Verifying integrity…</p>
            </div>
          </div>
        </div>
      )}


      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="p-10 md:p-14 border-b border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div className="space-y-1 flex-grow">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-blue-600">
                {asset.brand} <span className="text-slate-300">—</span>{" "}
                <Link href={`/specs?category=${asset.category}`} className="hover:underline">
                  {formatCategoryLabel(asset.category)}
                </Link>
              </div>
              <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none py-2">
                {asset.model_name}
              </h1>
              <p
                className={`text-[10px] font-black uppercase tracking-widest ${isVerifiedAudit ? "text-emerald-600" : "text-slate-400"
                  }`}
              >
                AUDIT STATUS: {auditStatusLabel}
              </p>
            </div>

            <div className="flex flex-col items-end gap-6 min-w-[220px]">
              <div className="text-right">
                <div className={`text-7xl font-black ${truthColor} leading-none`}>
                  {isVerifiedAudit ? effectiveAudit?.truth_index || "--" : "--"}%
                </div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">
                  {isVerifiedAudit ? "Truth Index" : "Pending Verification"}
                </p>

                {/* Desktop "Compare" under the Truth Index */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsComparisonOpen(true);
                    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
                  }}
                  className="mt-2 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center justify-end gap-1 ml-auto border border-transparent hover:border-blue-100"
                >
                  <span className="text-lg leading-none mt-[-2px]">+</span> COMPARE
                </button>

                {/* Score Breakdown Expandable */}
                {effectiveAudit?.truth_index_breakdown && (
                  <button
                    onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                    className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors ml-auto flex items-center gap-1"
                  >
                    {showScoreBreakdown ? '▾' : '▸'} {isVerifiedAudit ? 'WHY THIS SCORE?' : 'SCORING METHODOLOGY'}
                  </button>
                )}
              </div>

              {/* Score Breakdown Expandable */}
              {showScoreBreakdown && effectiveAudit?.truth_index_breakdown && (() => {
                const b = effectiveAudit.truth_index_breakdown;
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[10px] font-mono space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="font-black uppercase tracking-widest text-slate-400 text-[9px] mb-2">Score Breakdown</div>
                    <table className="w-full">
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="py-1 text-slate-500">Claims Accuracy</td>
                          <td className="py-1 text-right font-bold text-slate-700">{isVerifiedAudit ? b.component_scores.claims_accuracy : '--'}</td>
                          <td className="py-1 text-right text-slate-400">× {(b.weights.claims_accuracy * 100).toFixed(0)}%</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1 text-slate-500">Real-World Fit</td>
                          <td className="py-1 text-right font-bold text-slate-700">{isVerifiedAudit ? b.component_scores.real_world_fit : '--'}</td>
                          <td className="py-1 text-right text-slate-400">× {(b.weights.real_world_fit * 100).toFixed(0)}%</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1 text-slate-500">Operational Noise</td>
                          <td className="py-1 text-right font-bold text-slate-700">{isVerifiedAudit ? b.component_scores.operational_noise : '--'}</td>
                          <td className="py-1 text-right text-slate-400">× {(b.weights.operational_noise * 100).toFixed(0)}%</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1 text-slate-500">Weighted Base</td>
                          <td className="py-1 text-right font-bold text-blue-600" colSpan={2}>{isVerifiedAudit ? b.base : 'Pending'}</td>
                        </tr>
                        {b.penalties.total !== 0 && (
                          <tr className="border-b border-slate-100">
                            <td className="py-1 text-red-500">Penalties</td>
                            <td className="py-1 text-right font-bold text-red-600" colSpan={2}>
                              {b.penalties.total}
                              <span className="text-slate-400 font-normal ml-1">
                                ({b.penalties.severe > 0 ? `${b.penalties.severe} severe` : ''}
                                {b.penalties.severe > 0 && b.penalties.moderate > 0 ? ', ' : ''}
                                {b.penalties.moderate > 0 ? `${b.penalties.moderate} moderate` : ''}
                                {(b.penalties.severe > 0 || b.penalties.moderate > 0) && b.penalties.minor > 0 ? ', ' : ''}
                                {b.penalties.minor > 0 ? `${b.penalties.minor} minor` : ''})
                              </span>
                            </td>
                          </tr>
                        )}
                        {b.llm_adjustment && (
                          <tr className="border-b border-slate-100">
                            <td className="py-1 text-amber-600">AI Adjustment</td>
                            <td className="py-1 text-right font-bold text-amber-600" colSpan={2}>
                              {b.llm_adjustment.delta > 0 ? '+' : ''}{b.llm_adjustment.delta}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="py-1.5 font-black text-slate-900">Final</td>
                          <td className="py-1.5 text-right font-black text-blue-600 text-sm" colSpan={2}>{b.final}</td>
                        </tr>
                      </tbody>
                    </table>
                    {b.llm_adjustment?.reason && (
                      <p className="text-[9px] text-amber-600 italic mt-1">
                        "{b.llm_adjustment.reason}"
                      </p>
                    )}
                  </div>
                );
              })()}

              {(!hasRevealedLedger || !effectiveAudit?.truth_index) && !isScanning && (
                <button
                  onClick={handleVerifyIntegrity}
                  className="w-full bg-blue-600 text-white font-black uppercase px-6 py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all text-xs tracking-widest"
                >
                  ▶ Retrieve Ledger Entry
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-10 md:p-14">
          <AuditResults product={asset} audit={visibleAudit} onRetryStage={handleRunStage} isRunning={isScanning} />
        </div>
      </div>

      <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] shadow-xl text-center">
        {!isComparisonOpen ? (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setIsComparisonOpen(true)}
              className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 hover:text-white transition-colors"
            >
              + Add Side-by-Side Comparison Asset
            </button>
            <button
              onClick={() => handleDeepScan(asset, true)}
              className="text-[9px] font-black uppercase tracking-widest text-slate-700 hover:text-slate-500 transition-colors"
              title="Force AI re-computation (Admin only)"
            >
              Admin: Force Re-audit
            </button>
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Compare {asset.brand} with:
              </p>
              <button
                onClick={() => setIsComparisonOpen(false)}
                className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>

            <AssetSelector
              category={asset.category}
              onSelect={(target) => router.push(`/compare/${asset.slug}-vs-${target.slug}`)}
              placeholder={`Search competitor ${formatCategoryLabel(asset.category).toLowerCase()}...`}
              className="text-left"
            />
          </div>
        )}
      </div>

      {/* Error Modal for Failed Audits */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-200 rounded-xl p-8 max-w-md w-full shadow-2xl">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 mb-3 text-center">
              Audit Failed
            </h3>
            <p className="text-sm text-slate-600 font-medium mb-6 text-center">{errorMessage}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowErrorModal(false)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowErrorModal(false);
                  handleDeepScan(asset, true);
                }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Compare Button (Scrolling) */}
      {!isComparisonOpen && (
        <div className="fixed bottom-6 right-4 md:right-8 z-40 transition-all duration-300 opacity-60 hover:opacity-100">
          <button
            onClick={() => {
              setIsComparisonOpen(true);
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }}
            className="group bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 text-white px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 hover:border-blue-500 hover:shadow-blue-900/50 transition-all flex items-center gap-3"
          >
            <span className="text-blue-400 text-xl leading-none group-hover:text-white transition-colors mt-[-2px]">+</span>
            <span>COMPARE</span>
          </button>
        </div>
      )}

    </div>
  );
}
