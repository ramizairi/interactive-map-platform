"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const InteractiveMap = dynamic(() => import("@/components/map/InteractiveMap"), {
  ssr: false,
  loading: () => (
    <main className="flex h-screen min-h-[680px] items-center justify-center bg-zinc-100 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-3 text-sm font-semibold shadow-xl dark:border-white/10 dark:bg-zinc-900">
        <Loader2 size={18} className="animate-spin" />
        Loading map
      </div>
    </main>
  ),
});

export function MapExperience() {
  return <InteractiveMap />;
}
