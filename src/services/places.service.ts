import type { Place, PlacesResponse } from "@/types/places";

export interface FetchPlacesOptions {
  bbox?: [number, number, number, number];
  region?: string;
  category?: string;
  search?: string;
  signal?: AbortSignal;
}

export async function fetchPlaces(options: FetchPlacesOptions = {}) {
  const params = new URLSearchParams();

  if (options.bbox) {
    params.set("bbox", options.bbox.join(","));
  }

  if (options.region) {
    params.set("region", options.region);
  }

  if (options.category && options.category !== "all") {
    params.set("category", options.category);
  }

  if (options.search) {
    params.set("q", options.search);
  }

  const response = await fetch(`/api/places?${params.toString()}`, {
    signal: options.signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Unable to load places.");
  }

  const payload = (await response.json()) as PlacesResponse;
  return payload;
}

export function findPlaceById(places: Place[], id: string) {
  return places.find((place) => place.id === id) || null;
}

export async function addPlaceImages(placeId: string, images: string[]) {
  const response = await fetch(`/api/places/${placeId}/images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ images }),
  });
  const payload = (await response.json().catch(() => null)) as { place?: Place; error?: string } | null;

  if (!response.ok || !payload?.place) {
    throw new Error(payload?.error || "Unable to add images to this place.");
  }

  return payload.place;
}
