"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AuditStatus = "pending" | "running" | "done" | "error" | "complete";

type AuditRun = {
  id: string;
  status: AuditStatus;
  progress?: number | null;
  last_heartbeat?: string | null;
  stage_state?: any;
  error?: any;
};

const POLL_MS = 1500;

export function useAuditRun(productId: string) {
  const storageKey = useMemo(() => `auditRunId:${productId}`, [productId]);

  const [runId, setRunId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(storageKey);
  });

  const [run, setRun] = useState<AuditRun | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const stopRef = useRef(false);

  const persistRunId = useCallback(
    (id: string | null) => {
      setRunId(id);
      if (typeof window === "undefined") return;
      if (id) sessionStorage.setItem(storageKey, id);
      else sessionStorage.removeItem(storageKey);
    },
    [storageKey]
  );

  const start = useCallback(async () => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      const json = await res.json();
      if (!res.ok || !json?.runId) throw new Error(json?.error ?? "Failed to start audit");

      persistRunId(json.runId);
      setRun({ id: json.runId, status: json.status ?? "pending" });
    } finally {
      setIsStarting(false);
    }
  }, [productId, persistRunId]);

  const pollOnce = useCallback(async () => {
    if (!runId) return;

    const res = await fetch(`/api/audit/status?runId=${encodeURIComponent(runId)}`, {
      method: "GET",
      headers: { "cache-control": "no-cache" },
    });

    const json = await res.json();
    if (!res.ok) {
      // If runId is invalid (deleted/reaped), stop polling and clear it
      persistRunId(null);
      setRun(null);
      return;
    }

    setRun(json.run ?? null);

    const st: AuditStatus | undefined = json?.run?.status;
    if (st === "done" || st === "complete" || st === "error") {
      setIsPolling(false);
      stopRef.current = true;
    }
  }, [runId, persistRunId]);

  // Startup recovery: Check if there's an active run for this product even if not in session
  useEffect(() => {
    if (runId) return;

    let ignored = false;
    async function checkActive() {
      try {
        const res = await fetch(`/api/audit/status?productId=${encodeURIComponent(productId)}`);
        if (!res.ok) return;
        const json = await res.json();

        // If API reports an active run, attach to it
        if (json.run && (json.run.status === "pending" || json.run.status === "running")) {
          if (!ignored) {
            persistRunId(json.run.id);
            setRun(json.run);
          }
        }
      } catch (e) {
        // Validation check failed, benign
      }
    }

    checkActive();
    return () => { ignored = true; };
  }, [productId, runId, persistRunId]);

  useEffect(() => {
    stopRef.current = false;

    if (!runId) return;
    setIsPolling(true);

    // immediate poll so UI doesn’t wait 1.5s
    pollOnce();

    const t = setInterval(() => {
      if (stopRef.current) return;
      pollOnce();
    }, POLL_MS);

    return () => clearInterval(t);
  }, [runId, pollOnce]);

  const isLive = run?.status === "pending" || run?.status === "running";

  return {
    runId,
    run,
    isLive,
    isStarting,
    isPolling,
    start,
    clear: () => {
      stopRef.current = true;
      setIsPolling(false);
      persistRunId(null);
      setRun(null);
    },
    refresh: pollOnce,
  };
}
