
import { getProductBySlug } from "./lib/dataBridge.server";
import { executeStage3 } from "./lib/stageExecutors";

// Mock environment for Supabase
process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
import { executeStage1 } from "./lib/stageExecutors";

async function main() {
    const mockProductBad = {
        model_name: "Dirty Specs 3000",
        brand: "Generic",
        technical_specs: {
            "Battery Capacity": "Not specified",
            "AC Output": "null",
            "Weight": "undefined",
            "Real Feature": "100 Watts"
        },
        category: "portable_power_station"
    };

    console.log("Testing Stage 1 Filtering...");
    const result = await executeStage1(mockProductBad);

    console.log("Filtered Stage 1 Result:");
    result.claim_profile.forEach(item => {
        console.log(`- ${item.label}: ${item.value}`);
    });

    if (result.claim_profile.length === 1 && result.claim_profile[0].label === "Real Feature") {
        console.log("✅ Filtering SUCCESS: Only 'Real Feature' remains.");
    } else {
        console.log("❌ Filtering FAILED: Unexpected items remaining.");
    }
}

main().catch(console.error);
