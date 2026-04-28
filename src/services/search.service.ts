import type { AutocompleteResponse } from "@/types/search";

export interface FetchAutocompleteOptions {
  query: string;
  region?: string;
  limit?: number;
  signal?: AbortSignal;
}

export async function fetchAutocomplete(options: FetchAutocompleteOptions) {
  const params = new URLSearchParams();
  params.set("q", options.query);

  if (options.region) {
    params.set("region", options.region);
  }

  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  const response = await fetch(`/api/search/autocomplete?${params.toString()}`, {
    signal: options.signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Unable to load search suggestions.");
  }

  return (await response.json()) as AutocompleteResponse;
}
