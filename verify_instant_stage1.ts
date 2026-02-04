
import { normalizeAuditResult } from "./lib/auditNormalizer";

const mockProduct = {
    slug: 'instant-test-product',
    technical_specs: [
        { label: 'Instant Spec', value: 'Hydrated' },
        { label: 'Not Specified', value: 'Not specified' }
    ]
};

const mockEmptyAudit = null;

console.log("Testing Instant Hydration...");
const result = normalizeAuditResult(mockEmptyAudit, mockProduct);

console.log("Resulting Claim Profile:");
result.claim_profile.forEach(p => console.log(`- ${p.label}: ${p.value}`));

if (result.claim_profile.length === 1 && result.claim_profile[0].label === 'Instant Spec') {
    console.log("✅ Success: Claim profile hydrated from product specs instantly (and filtered).");
} else {
    console.log("❌ Failure: Claims not hydrated correctly.");
}
