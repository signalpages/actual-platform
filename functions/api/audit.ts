export async function onRequestPost() {
  return new Response(
    JSON.stringify({
      ok: true,
      code: "PROVISIONAL_ONLY",
      message: "Audit endpoint is live. Full forensic not wired yet.",
      verdict: "Provisional Synthesis Required",
      truth_index: null,
      discrepancies: [
        {
          severity: "info",
          title: "Endpoint live",
          detail: "Deploy succeeded and /api/audit is reachable."
        }
      ]
    }),
    {
      headers: { "content-type": "application/json; charset=utf-8" }
    }
  );
}
