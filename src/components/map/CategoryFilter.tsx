"use client";

import { Hammer, Hotel, Sparkles, Sprout, Store, Utensils, type LucideIcon } from "lucide-react";
import { mapConfig, type CategoryDefinition } from "@/config/map";

const icons: Record<CategoryDefinition["icon"], LucideIcon> = {
  Sparkles,
  Hotel,
  Utensils,
  Store,
  Sprout,
  Hammer,
};

interface CategoryFilterProps {
  selected: string;
  counts: Record<string, number>;
  onSelect: (category: string) => void;
}

export function CategoryFilter({ selected, counts, onSelect }: CategoryFilterProps) {
  return (
    <>
      {/* ── Mobile: horizontal scrolling pill strip ── */}
      <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-0.5 md:hidden">
        {mapConfig.categories.map((category) => {
          const Icon = icons[category.icon];
          const isSelected = selected === category.id;
          const count = category.id === "all" ? counts.all || 0 : counts[category.id] || 0;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              aria-pressed={isSelected}
              title={category.label}
              className={[
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all duration-200",
                isSelected
                  ? "border-transparent bg-zinc-950 text-white shadow-[0_4px_16px_rgba(15,23,42,0.28)] dark:bg-white dark:text-zinc-950"
                  : "border-black/8 bg-white/80 text-zinc-700 shadow-[0_2px_8px_rgba(15,23,42,0.1)] backdrop-blur-2xl hover:bg-white hover:shadow-[0_4px_16px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:bg-zinc-900/90",
              ].join(" ")}
            >
              <Icon size={13} style={{ color: isSelected ? undefined : category.color }} />
              <span>{category.label}</span>
              {count > 0 && (
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                    isSelected
                      ? "bg-white/20 text-white dark:bg-black/20 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400",
                  ].join(" ")}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Desktop: vertical glass panel ── */}
      <div className="pointer-events-auto hidden w-[210px] overflow-hidden rounded-2xl border border-black/[0.07] bg-white/75 shadow-[0_16px_48px_rgba(15,23,42,0.16),0_2px_8px_rgba(15,23,42,0.08)] backdrop-blur-[32px] saturate-150 transition-shadow hover:shadow-[0_24px_64px_rgba(15,23,42,0.2)] dark:border-white/[0.07] dark:bg-zinc-950/75 md:block">
        <div className="flex flex-col p-1.5 gap-0.5">
          {mapConfig.categories.map((category) => {
            const Icon = icons[category.icon];
            const isSelected = selected === category.id;
            const count = category.id === "all" ? counts.all || 0 : counts[category.id] || 0;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelect(category.id)}
                aria-pressed={isSelected}
                title={category.label}
                className={[
                  "group flex h-11 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition-all duration-200",
                  isSelected
                    ? "bg-zinc-950 text-white shadow-[0_4px_14px_rgba(15,23,42,0.22)] dark:bg-white dark:text-zinc-950"
                    : "text-zinc-700 hover:bg-black/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.07]",
                ].join(" ")}
              >
                {/* Icon chip */}
                <span
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                    isSelected ? "bg-white/15 dark:bg-black/15" : "",
                  ].join(" ")}
                  style={!isSelected ? { backgroundColor: `${category.color}1a` } : undefined}
                >
                  <Icon
                    size={15}
                    style={{ color: isSelected ? undefined : category.color }}
                  />
                </span>

                <span className="min-w-0 flex-1 truncate text-left font-semibold">{category.label}</span>

                {/* Count badge */}
                <span
                  className={[
                    "min-w-[22px] rounded-lg px-1.5 py-0.5 text-center text-[11px] font-semibold leading-5",
                    isSelected
                      ? "bg-white/18 text-white/80 dark:bg-black/18 dark:text-black/70"
                      : "bg-zinc-100/80 text-zinc-500 dark:bg-white/8 dark:text-zinc-400",
                  ].join(" ")}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
