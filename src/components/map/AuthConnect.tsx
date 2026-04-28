"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, Heart, LayoutDashboard, LogIn, UserRound, X } from "lucide-react";
import type { PublicUser } from "@/types/auth";

export function AuthConnect() {
  const [isOpen, setOpen] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((payload: { user: PublicUser | null }) => setUser(payload.user))
      .catch(() => setUser(null));
  }, []);

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-2xl border border-black/[0.07] bg-white/80 px-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_28px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.08)] backdrop-blur-[32px] saturate-150 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/92 hover:shadow-[0_16px_42px_rgba(15,23,42,0.2)] dark:border-white/[0.07] dark:bg-zinc-950/80 dark:text-zinc-100 dark:hover:bg-zinc-900/90"
      >
        <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300">
          {user?.avatarUrl ? (
            <Image src={user.avatarUrl} alt="" fill sizes="28px" unoptimized className="object-cover" />
          ) : user ? (
            <UserRound size={15} />
          ) : (
            <LogIn size={15} />
          )}
        </span>
        <span className="hidden sm:inline">{user ? user.name.split(" ")[0] : "Connect"}</span>
      </button>

      {/* ── Dropdown panel ── */}
      {isOpen ? (
        <div className="animate-fade-slide-up pointer-events-auto absolute right-0 top-14 z-50 w-[min(92vw,340px)] overflow-hidden rounded-2xl border border-black/[0.07] bg-white/92 shadow-[0_24px_72px_rgba(15,23,42,0.24),0_4px_16px_rgba(15,23,42,0.1)] backdrop-blur-[32px] saturate-150 dark:border-white/[0.07] dark:bg-zinc-950/92 dark:text-zinc-50">
          
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-4 py-3.5 dark:border-white/[0.06]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                Account
              </p>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {user ? `Welcome, ${user.name.split(" ")[0]}` : "Sign in to contribute"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/8 dark:hover:text-zinc-200"
              aria-label="Close account panel"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-3 grid gap-2">
            {!user ? (
              <>
                <Link
                  href="/signin"
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  <LogIn size={16} />
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-zinc-100 dark:hover:bg-white/[0.09]"
                >
                  <UserRound size={16} />
                  Create account
                </Link>
              </>
            ) : null}
            <Link
              href="/dashboard"
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-400/15 dark:bg-emerald-400/8 dark:text-emerald-300 dark:hover:bg-emerald-400/14"
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
          </div>

          {/* Feature hints */}
          <div className="border-t border-black/[0.06] px-3 py-3 grid gap-1.5 dark:border-white/[0.06]">
            <div className="flex items-center gap-2.5 rounded-xl bg-zinc-50/80 px-3 py-2.5 text-xs text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
              <Camera size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              Upload place images after signing in.
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-zinc-50/80 px-3 py-2.5 text-xs text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
              <Heart size={14} className="shrink-0 text-rose-500 dark:text-rose-400" />
              Your profile tracks reviews, ratings & reactions.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
