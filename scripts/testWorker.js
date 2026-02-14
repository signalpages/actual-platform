// Test worker endpoint directly
fetch("http://localhost:3000/api/audit/worker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId: "test-run-id" })
})
    .then(r => r.json())
    .then(data => console.log("Worker response:", data))
    .catch(err => console.error("Worker error:", err));
