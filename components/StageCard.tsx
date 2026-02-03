"use client";

import React from "react";

interface StageCardProps {
  stageNumber: number;
  title: string;
  description?: string;
  status?: "pending" | "running" | "done" | "error" | string;
  data?: any;
  estimatedTime?: string;
  children?: React.ReactNode;
}

/**
 * StageCard (V1)
 * - Pure presentational wrapper
 * - DOES NOT reinterpret data shape
 * - DOES NOT gate rendering based on analysis.status
 * - Parent component provides the content
 */
export function StageCard({
  stageNumber,
  title,
  description,
  status = "pending",
  data,
  estimatedTime,
  children,
}: StageCardProps) {
  const isDone = status === "done";
  const isRunning = status === "running";
  const isPending = status === "pending";
  const isError = status === "error";

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className={[
            "h-10 w-10 rounded-full flex items-center justify-center font-black",
            isDone
              ? "bg-emerald-600 text-white"
              : isRunning
              ? "bg-amber-400 text-white"
              : isError
              ? "bg-red-500 text-white"
              : "bg-slate-200 text-slate-600",
          ].join(" ")}
        >
          {isDone ? "✓" : stageNumber}
        </div>

        <div className="flex-1">
          <div className="text-xl font-black tracking-tight">
            STAGE {stageNumber}: {title.toUpperCase()}
          </div>

          <div
            className={[
              "text-sm font-bold uppercase",
              isDone
                ? "text-emerald-700"
                : isRunning
                ? "text-amber-600"
                : isError
                ? "text-red-600"
                : "text-slate-400",
            ].join(" ")}
          >
            {isDone ? "COMPLETED (SNAPSHOT)" : isRunning ? "IN PROGRESS" : isError ? "ERROR" : "PENDING"}
            {estimatedTime ? ` · ${estimatedTime}` : ""}
          </div>

          {description ? <div className="text-slate-600 text-sm mt-1">{description}</div> : null}
        </div>
      </div>

      {/* Body */}
      <div className="mt-6">
        {children ? (
          children
        ) : isPending && !data ? (
          <div className="text-sm text-slate-400">Waiting for audit stage to begin…</div>
        ) : (
          // default: don't dump JSON into UI; keep hidden for debugging
          <pre className="hidden">{JSON.stringify(data)}</pre>
        )}
      </div>
    </section>
  );
}
