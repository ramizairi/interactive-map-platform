"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, MapPin, Search, Tags, X } from "lucide-react";
import { fetchAutocomplete } from "@/services/search.service";
import type { SearchSuggestion } from "@/types/search";

interface MapSearchProps {
  value: string;
  region: string;
  onChange: (value: string) => void;
  onResetView: () => void;
  onSelectSuggestion: (suggestion: SearchSuggestion) => void;
}

export function MapSearch({ value, region, onChange, onResetView, onSelectSuggestion }: MapSearchProps) {
  const [isOpen, setOpen] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = value.trim();
  const showSuggestions = isOpen && query.length >= 2;

  useEffect(() => {
    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      fetchAutocomplete({
        query,
        region,
        limit: 8,
        signal: controller.signal,
      })
        .then((payload) => setSuggestions(payload.suggestions))
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }

          setSuggestions([]);
          setError(err instanceof Error ? err.message : "Search is unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, region]);

  function handleSuggestionSelect(suggestion: SearchSuggestion) {
    onSelectSuggestion(suggestion);
    setOpen(false);
  }

  return (
    <div className="pointer-events-auto relative">
      {/* ── Search bar ── */}
      <div
        className={[
          "flex h-[54px] items-center gap-2.5 overflow-hidden rounded-2xl border px-3 transition-all duration-200",
          "border-black/[0.07] bg-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.13),0_2px_8px_rgba(15,23,42,0.07)]",
          "backdrop-blur-[32px] saturate-150",
          "focus-within:border-black/[0.12] focus-within:bg-white/92 focus-within:shadow-[0_16px_48px_rgba(15,23,42,0.2)]",
          "dark:border-white/[0.08] dark:bg-zinc-950/80 dark:focus-within:bg-zinc-950/92 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        ].join(" ")}
      >
        {/* Search icon */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100/80 text-zinc-500 transition-colors dark:bg-white/8 dark:text-zinc-400">
          {isLoading && showSuggestions ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
        </span>

        <input
          value={value}
          onFocus={() => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => setOpen(false), 140);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          placeholder="Search restaurants, markets…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-950 outline-none placeholder:font-normal placeholder:text-zinc-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          aria-controls="map-search-suggestions"
        />

        {/* Clear button */}
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSuggestions([]);
              setOpen(false);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        ) : null}

        {/* Region pill */}
        <button
          type="button"
          onClick={onResetView}
          className="hidden h-8 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-400/12 dark:text-emerald-300 dark:hover:bg-emerald-400/18 sm:flex"
        >
          <MapPin size={13} />
          {region}
        </button>
      </div>

      {/* ── Dropdown suggestions ── */}
      {showSuggestions ? (
        <div
          id="map-search-suggestions"
          role="listbox"
          className="animate-fade-slide-up absolute left-0 right-0 top-[62px] z-50 overflow-hidden rounded-2xl border border-black/[0.07] bg-white/88 p-2 shadow-[0_16px_56px_rgba(15,23,42,0.2),0_4px_16px_rgba(15,23,42,0.1)] backdrop-blur-[32px] saturate-150 dark:border-white/[0.07] dark:bg-zinc-950/88"
        >
          {error ? (
            <div className="px-3 py-2.5 text-sm font-medium text-orange-700 dark:text-orange-300">{error}</div>
          ) : null}
          {!error && !isLoading && suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-sm font-medium text-zinc-400 dark:text-zinc-500">No matches found</div>
          ) : null}
          <div className="grid gap-0.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSuggestionSelect(suggestion)}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-zinc-100/80 dark:hover:bg-white/[0.07]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100/80 text-zinc-600 dark:bg-white/8 dark:text-zinc-300">
                  <SuggestionIcon suggestion={suggestion} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {suggestion.label}
                  </span>
                  {suggestion.subtitle ? (
                    <span className="block truncate text-xs font-medium capitalize text-zinc-500 dark:text-zinc-400">
                      {suggestion.subtitle}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 rounded-lg bg-zinc-100/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-white/8 dark:text-zinc-400">
                  {suggestion.kind}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SuggestionIcon({ suggestion }: { suggestion: SearchSuggestion }) {
  if (suggestion.kind === "category") {
    return <Tags size={16} style={{ color: suggestion.color }} />;
  }

  if (suggestion.kind === "region" && suggestion.status === "locked") {
    return <Lock size={16} className="text-red-400" />;
  }

  return <MapPin size={16} className="text-emerald-600 dark:text-emerald-400" />;
}
