import { NextRequest } from "next/server";
import { getMongoDb, getMongoErrorMessage, isMongoConfigured } from "@/lib/mongodb";
import { buildPlacesQuery, normalizePlace, type PlaceDocument } from "@/models/place";
import { mapConfig } from "@/config/map";

export const runtime = "nodejs";

const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get("region") || mapConfig.defaultRegion;
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("q")?.trim() || undefined;
  const bbox = parseBbox(searchParams.get("bbox"));
  const limit = clampLimit(searchParams.get("limit"));

  if (!isMongoConfigured()) {
    return Response.json({
      places: [],
      meta: {
        isConfigured: false,
        count: 0,
        region,
      },
    });
  }

  try {
    const db = await getMongoDb();
    const collection = db.collection<PlaceDocument>(process.env.MONGODB_PLACES_COLLECTION || "places");
    const query = buildPlacesQuery({ bbox, region, category, search });

    const docs = await collection
      .find(query, {
        limit,
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

    const places = docs.map(normalizePlace).filter(Boolean);

    return Response.json({
      places,
      meta: {
        isConfigured: true,
        count: places.length,
        region,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: getMongoErrorMessage(error),
        places: [],
        meta: {
          isConfigured: true,
          count: 0,
          region,
        },
      },
      { status: 503 },
    );
  }
}

function parseBbox(value: string | null): [number, number, number, number] | undefined {
  if (!value) {
    return undefined;
  }

  const parts = value.split(",").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }

  const [west, south, east, north] = parts;

  if (west >= east || south >= north) {
    return undefined;
  }

  return [west, south, east, north];
}

function clampLimit(value: string | null) {
  const limit = Number(value || 250);

  if (!Number.isFinite(limit)) {
    return 250;
  }

  return Math.min(Math.max(Math.round(limit), 1), MAX_LIMIT);
}
