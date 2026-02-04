"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-extrabold tracking-tight text-red-600">
          PROTOCOL EXCEPTION
        </h1>
        <p className="mt-3 text-neutral-700">
          The forensic engine encountered a critical synthesis error.
        </p>

        <pre className="mt-6 whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-sm text-neutral-800">
          {error?.message || "Unknown error"}
        </pre>

        <button
          onClick={() => reset()}
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white"
        >
          RETRY SYNTHESIS
        </button>
      </div>
    </div>
  );
}
