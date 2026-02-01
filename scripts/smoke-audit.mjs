import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || "http://localhost:4321";
const SLUG = process.argv[2];

if (!SLUG) {
    console.error("Usage: node smoke-audit.mjs <slug>");
    process.exit(1);
}

console.log(`🚬 Smoke Testing: ${BASE_URL}/api/audit with slug="${SLUG}"`);

try {
    const resp = await fetch(`${BASE_URL}/api/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: SLUG })
    });

    console.log(`HTTP Status: ${resp.status}`);
    const data = await resp.json();
    console.log("Response Body:", JSON.stringify(data, null, 2));

    if (resp.status !== 200) {
        console.error("❌ Failed: Status should be 200 (even for app errors)");
        process.exit(1);
    }

    if (data.ok === false) {
        if (data.error === "ASSET_NOT_FOUND") {
            console.log("✅ Correctly identified missing asset.");
        } else {
            console.warn("⚠️ App Error returned:", data.error);
        }
    } else if (data.ok === true && data.audit) {
        console.log("✅ Audit returned successfully.");
    } else {
        console.error("❌ Invalid response shape");
        process.exit(1);
    }

} catch (e) {
    console.error("💥 Network/Script Error:", e);
    process.exit(1);
}
