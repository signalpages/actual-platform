// StagedAuditDemo.tsx
"use client";

import React from "react";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

function formatUtcDate(input?: string | number | Date | null): string {
  if (!input) return "—";
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) return "—";
  return DATE_FMT.format(dt);
}

type Props = {
  // adjust these props to your real types
  last_run_at?: string | null;
  // ...other props
};

export default function StagedAuditDemo(props: Props) {
  const lastRunText = formatUtcDate(props.last_run_at);

  return (
    <div>
      {/* wherever you currently show last_run_at */}
      <div className="text-xs text-neutral-500">Snapshot: {lastRunText}</div>

      {/* rest of your component unchanged */}
    </div>
  );
}
