import { NextRequest } from "next/server";
import { mapConfig } from "@/config/map";
import { getMongoDb, getMongoErrorMessage, isMongoConfigured } from "@/lib/mongodb";
import { buildPlacesQuery, normalizePlace, type PlaceDocument } from "@/models/place";
import type { Place, PlaceCategory } from "@/types/places";
import type { SearchSuggestion } from "@/types/search";

export const runtime = "nodejs";

const MAX_LIMIT = 10;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") || "").trim();
  const region = searchParams.get("region") || mapConfig.defaultRegion;
  const limit = clampLimit(searchParams.get("limit"));

  if (query.length < 2) {
    return Response.json({
      suggestions: [],
      meta: {
        isConfigured: isMongoConfigured(),
        query,
        count: 0,
      },
    });
  }

  const suggestions: SearchSuggestion[] = [
    ...getCategorySuggestions(query),
    ...getRegionSuggestions(query),
  ].slice(0, limit);

  if (!isMongoConfigured() || suggestions.length >= limit) {
    return Response.json({
      suggestions,
      meta: {
        isConfigured: isMongoConfigured(),
        query,
        count: suggestions.length,
      },
    });
  }

  try {
    const db = await getMongoDb();
    const collection = db.collection<PlaceDocument>(process.env.MONGODB_PLACES_COLLECTION || "places");
    const docs = await collection
      .find(buildPlacesQuery({ region, search: query }), {
        limit: limit - suggestions.length,
        projection: {
          name: 1,
          category: 1,
          description: 1,
          images: 1,
          address: 1,
          region: 1,
          city: 1,
          zone: 1,
          sourceId: 1,
          originalCategory: 1,
          subCategory: 1,
          specialties: 1,
          hours: 1,
          contact: 1,
          budget: 1,
          practicalNotes: 1,
          googleMapsUrl: 1,
          location: 1,
          coordinates: 1,
          longitude: 1,
          latitude: 1,
          lng: 1,
          lat: 1,
          x: 1,
          y: 1,
          X: 1,
          Y: 1,
          avgRating: 1,
          reviewsCount: 1,
          isActive: 1,
        },
      })
      .sort({ reviewsCount: -1, avgRating: -1, name: 1 })
      .toArray();

    const placeSuggestions = docs
      .map(normalizePlace)
      .filter((place): place is Place => Boolean(place))
      .map<SearchSuggestion>((place) => ({
        id: `place:${place.id}`,
        kind: "place",
        label: place.name,
        subtitle: [place.category, place.address || place.region].filter(Boolean).join(" - "),
        place,
      }));

    const allSuggestions = [...suggestions, ...placeSuggestions].slice(0, limit);

    return Response.json({
      suggestions: allSuggestions,
      meta: {
        isConfigured: true,
        query,
        count: allSuggestions.length,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: getMongoErrorMessage(error),
        suggestions,
        meta: {
          isConfigured: true,
          query,
          count: suggestions.length,
        },
      },
      { status: 503 },
    );
  }
}

function getCategorySuggestions(query: string): SearchSuggestion[] {
  const normalized = normalizeText(query);

  return mapConfig.categories
    .filter((category) => {
      const haystack = normalizeText(`${category.id} ${category.label}`);
      return haystack.includes(normalized);
    })
    .map((category) => ({
      id: `category:${category.id}`,
      kind: "category",
      label: category.label,
      subtitle: category.id === "all" ? "Show every place" : `Filter by ${category.label.toLowerCase()}`,
      category: category.id as PlaceCategory | "all",
      color: category.color,
    }));
}

function getRegionSuggestions(query: string): SearchSuggestion[] {
  const normalized = normalizeText(query);

  return mapConfig.regions
    .filter((region) => normalizeText(region.name).includes(normalized))
    .map((region) => ({
      id: `region:${region.id}`,
      kind: "region",
      label: region.name,
      subtitle: region.status === "enabled" ? "Available region" : "Coming soon",
      regionId: region.id,
      center: region.center,
      status: region.status,
    }));
}

function clampLimit(value: string | null) {
  const limit = Number(value || 8);

  if (!Number.isFinite(limit)) {
    return 8;
  }

  return Math.min(Math.max(Math.round(limit), 1), MAX_LIMIT);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
