import React from 'react';
import { Asset, ProductCategory, ProductAudit } from "@/types";
import { CanonicalAuditResult } from "@/lib/auditNormalizer";
import { CATEGORY_RULES } from "@/lib/audit/categoryRules";
import { SpecRow } from "./SpecRow";

interface SpecCardProps {
    product: Asset;
    audit?: CanonicalAuditResult | null;
    className?: string;
    realtimeAudits?: Record<string, ProductAudit>;
}

export function SpecCard({ product, audit, className = "", realtimeAudits = {} }: SpecCardProps) {
    const category = product.category as ProductCategory;
    const rules = CATEGORY_RULES[category] || [];

    if (rules.length === 0) return null;

    // Helper to find value for a rule
    const getValue = (ruleKey: string, ruleLabel: string) => {
        // Priority 0: Audit Snapshot (Stage 1) - The Source of Truth for Verification
        if (audit?.claim_profile && Array.isArray(audit.claim_profile)) {
            const found = audit.claim_profile.find(c =>
                c.label?.toLowerCase() === ruleLabel.toLowerCase() ||
                c.label?.toLowerCase() === ruleKey.toLowerCase()
            );
            if (found) return found.value;
        }

        // 1. Try structured display/numeric schema (Phase 1/6)
        if (product.technical_specs?.numeric?.[ruleKey] !== undefined) {
            return product.technical_specs.numeric[ruleKey];
        }
        if (product.technical_specs?.display?.[ruleKey]) {
            return product.technical_specs.display[ruleKey];
        }
        if (product.technical_specs?.display?.[ruleLabel]) {
            return product.technical_specs.display[ruleLabel];
        }

        // 2. Try direct access on technical_specs (Legacy Flat)
        if (product.technical_specs?.[ruleKey]) {
            return product.technical_specs[ruleKey];
        }

        // 3. Try searching array format (Legacy Item)
        if (Array.isArray(product.technical_specs)) {
            const found = product.technical_specs.find((s: any) =>
                (s.key === ruleKey) ||
                (s.label && s.label.toLowerCase() === ruleLabel.toLowerCase()) ||
                (s.name && s.name.toLowerCase() === ruleLabel.toLowerCase())
            );
            if (found) return found.value || found.spec_value;
        }

        // 4. Try items array (Legacy Wrapper)
        if (product.technical_specs?.items && Array.isArray(product.technical_specs.items)) {
            const found = product.technical_specs.items.find((s: any) =>
                (s.key === ruleKey) ||
                (s.label && s.label.toLowerCase() === ruleLabel.toLowerCase())
            );
            if (found) return found.value;
        }

        return null;
    };

    return (
        <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Official Specs
                </h3>
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                    {rules.length} Data Points
                </span>
            </div>

            <div className="divide-y divide-slate-100 bg-slate-50/50">
                {rules.map((rule, idx) => {
                    const value = getValue(rule.key, rule.label);

                    if (!value || value === 'null' || value === 'undefined') return null;

                    // Match realtime audit by Label (Field Name)
                    // Ensure case-insensitivity or exact match based on Worker logic using the Label.
                    const auditEntry = realtimeAudits[rule.label] ||
                        Object.values(realtimeAudits).find(a => a?.field_name?.toLowerCase() === rule.label.toLowerCase());

                    return (
                        <div key={rule.key} className="px-2 py-1">
                            <SpecRow
                                label={rule.label}
                                claimedValue={String(value)}
                                auditEntry={auditEntry}
                                delayIndex={idx}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
