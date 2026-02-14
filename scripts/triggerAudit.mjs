// Quick test script to trigger a fresh audit
// Run with: node --loader ts-node/esm scripts/triggerAudit.mjs

const PRODUCT_ID = "a70b745d-7562-49ac-a018-545c6ce946f7"; // Replace with your product ID

async function triggerAudit() {
    console.log("Triggering audit for product:", PRODUCT_ID);

    const response = await fetch("http://localhost:3000/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: PRODUCT_ID })
    });

    const data = await response.json();
    console.log("Response:", data);

    if (data.runId) {
        console.log("\n✅ Audit started! Run ID:", data.runId);
        console.log("Poll status at: http://localhost:3000/api/status?runId=" + data.runId);

        // Poll for completion
        let attempts = 0;
        while (attempts < 60) {
            await new Promise(r => setTimeout(r, 5000)); // Wait 5s

            const statusResp = await fetch(`http://localhost:3000/api/status?runId=${data.runId}`);
            const status = await statusResp.json();

            console.log(`[${attempts + 1}] Status: ${status.status} | Progress: ${status.activeRun?.progress}%`);

            if (status.status === "done") {
                console.log("\n✅ Audit complete!");
                console.log("Truth Index:", status.truth_index);
                console.log("Stage 1 claims:", status.stages?.stage_1?.data?.claim_profile?.length || 0);
                console.log("Stage 2 praised:", status.stages?.stage_2?.data?.most_praised?.length || 0);
                console.log("Stage 3 red flags:", status.stages?.stage_3?.data?.red_flags?.length || 0);
                console.log("Stage 4 verdict:", status.stages?.stage_4?.data?.score_interpretation);
                break;
            }

            if (status.status === "error" || status.status === "failed") {
                console.error("\n❌ Audit failed:", status.activeRun?.error);
                break;
            }

            attempts++;
        }
    }
}

triggerAudit().catch(console.error);
