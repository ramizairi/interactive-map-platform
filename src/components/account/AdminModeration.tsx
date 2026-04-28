"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Loader2, ShieldCheck, X } from "lucide-react";
import type { PendingPlaceRequest } from "@/types/auth";

export function AdminModeration({ requests }: { requests: PendingPlaceRequest[] }) {
  const router = useRouter();
  const [activeRequest, setActiveRequest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(id: string, action: "approve" | "reject" | "verify" | "ai-approve") {
    setError(null);
    setActiveRequest(`${action}:${id}`);

    try {
      const response = await fetch("/api/admin/places/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Could not moderate this place.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not moderate this place.");
    } finally {
      setActiveRequest(null);
    }
  }

  if (!requests.length) {
    return <p className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">No pending place requests.</p>;
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm font-semibold text-orange-800 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200">
          {error}
        </div>
      ) : null}
      {requests.map((request) => (
        <article key={request.id} className="rounded-lg border border-black/10 bg-white/84 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{request.name}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {request.category} in {request.region} by @{request.submittedByUsername}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {request.coordinates[0]}, {request.coordinates[1]}
              </p>
              {request.address ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{request.address}</p> : null}
              {request.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">{request.description}</p> : null}
              <VerificationBadge request={request} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end lg:max-w-[360px]">
              <button
                type="button"
                onClick={() => moderate(request.id, "verify")}
                disabled={activeRequest !== null}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                {activeRequest === `verify:${request.id}` ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                Verify
              </button>
              <button
                type="button"
                onClick={() => moderate(request.id, "ai-approve")}
                disabled={activeRequest !== null}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {activeRequest === `ai-approve:${request.id}` ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                AI approve
              </button>
              <button
                type="button"
                onClick={() => moderate(request.id, "approve")}
                disabled={activeRequest !== null}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeRequest === `approve:${request.id}` ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Approve
              </button>
              <button
                type="button"
                onClick={() => moderate(request.id, "reject")}
                disabled={activeRequest !== null}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeRequest === `reject:${request.id}` ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                Reject
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function VerificationBadge({ request }: { request: PendingPlaceRequest }) {
  const verification = request.aiVerification;

  if (!verification) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-white/15 dark:bg-white/5 dark:text-zinc-400">
        Gemini verification has not run yet.
      </div>
    );
  }

  const tone =
    verification.recommendation === "approve"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100"
      : verification.recommendation === "reject"
        ? "border-red-200 bg-red-50 text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100"
        : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100";

  return (
    <div className={`mt-3 rounded-lg border p-3 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        <Bot size={16} />
        Gemini: {verification.recommendation.replace("_", " ")}
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-zinc-700 dark:bg-black/20 dark:text-zinc-200">
          {Math.round(verification.confidence * 100)}%
        </span>
      </div>
      <p className="mt-2 leading-6">{verification.summary}</p>
      {verification.issues.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {verification.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
