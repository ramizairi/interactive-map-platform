import "server-only";

import type { Document, Filter, ObjectId } from "mongodb";
import type { Coordinates, Place, PlaceCategory } from "@/types/places";
import { mapConfig, supportedCategoryIds } from "@/config/map";

export interface PlaceDocument extends Document {
  _id?: ObjectId | string;
  name?: string;
  category?: string;
  description?: string;
  images?: string[];
  address?: string;
  region?: string;
  city?: string;
  zone?: string;
  sourceId?: string;
  originalCategory?: string;
  subCategory?: string;
  specialties?: string;
  hours?: string;
  contact?: string;
  budget?: string;
  practicalNotes?: string;
  googleMapsUrl?: string;
  location?: {
    type?: string;
    coordinates?: unknown;
  };
  coordinates?: unknown;
  longitude?: unknown;
  latitude?: unknown;
  lng?: unknown;
  lat?: unknown;
  x?: unknown;
  y?: unknown;
  X?: unknown;
  Y?: unknown;
  avgRating?: unknown;
  reviewsCount?: unknown;
  isActive?: unknown;
}

export function normalizePlace(doc: PlaceDocument): Place | null {
  const coordinates = extractCoordinates(doc);

  if (!doc._id || !doc.name || !coordinates) {
    return null;
  }

  const category = normalizeCategory(doc.category);

  return {
    id: String(doc._id),
    name: doc.name,
    category,
    description: typeof doc.description === "string" ? doc.description : undefined,
    images: Array.isArray(doc.images) ? doc.images.filter((image): image is string => typeof image === "string") : [],
    address: typeof doc.address === "string" ? doc.address : undefined,
    region: typeof doc.region === "string" ? doc.region : mapConfig.defaultRegion,
    city: typeof doc.city === "string" ? doc.city : undefined,
    zone: typeof doc.zone === "string" ? doc.zone : undefined,
    sourceId: typeof doc.sourceId === "string" ? doc.sourceId : undefined,
    originalCategory: typeof doc.originalCategory === "string" ? doc.originalCategory : undefined,
    subCategory: typeof doc.subCategory === "string" ? doc.subCategory : undefined,
    specialties: typeof doc.specialties === "string" ? doc.specialties : undefined,
    hours: typeof doc.hours === "string" ? doc.hours : undefined,
    contact: typeof doc.contact === "string" ? doc.contact : undefined,
    budget: typeof doc.budget === "string" ? doc.budget : undefined,
    practicalNotes: typeof doc.practicalNotes === "string" ? doc.practicalNotes : undefined,
    googleMapsUrl: typeof doc.googleMapsUrl === "string" ? doc.googleMapsUrl : undefined,
    location: {
      type: "Point",
      coordinates,
    },
    avgRating: toNumber(doc.avgRating, 0),
    reviewsCount: Math.max(0, Math.round(toNumber(doc.reviewsCount, 0))),
    isActive: doc.isActive !== false,
  };
}

export function buildPlacesQuery(options: {
  bbox?: [number, number, number, number];
  region?: string;
  category?: string;
  search?: string;
}) {
  const filters: Filter<PlaceDocument>[] = [{ isActive: { $ne: false } }];

  if (options.region && options.region !== "all") {
    filters.push({ region: options.region });
  }

  if (options.category && options.category !== "all" && supportedCategoryIds.has(options.category as PlaceCategory)) {
    filters.push({ category: options.category });
  }

  if (options.search) {
    const pattern = escapeRegex(options.search);
    filters.push({
      $or: [
        { name: { $regex: pattern, $options: "i" } },
        { address: { $regex: pattern, $options: "i" } },
        { description: { $regex: pattern, $options: "i" } },
        { city: { $regex: pattern, $options: "i" } },
        { zone: { $regex: pattern, $options: "i" } },
        { originalCategory: { $regex: pattern, $options: "i" } },
        { subCategory: { $regex: pattern, $options: "i" } },
        { specialties: { $regex: pattern, $options: "i" } },
      ],
    });
  }

  if (options.bbox) {
    const [west, south, east, north] = options.bbox;
    filters.push({
      $or: [
        {
          "location.coordinates.0": { $gte: west, $lte: east },
          "location.coordinates.1": { $gte: south, $lte: north },
        },
        { longitude: { $gte: west, $lte: east }, latitude: { $gte: south, $lte: north } },
        { lng: { $gte: west, $lte: east }, lat: { $gte: south, $lte: north } },
        { x: { $gte: west, $lte: east }, y: { $gte: south, $lte: north } },
        { X: { $gte: west, $lte: east }, Y: { $gte: south, $lte: north } },
      ],
    });
  }

  return filters.length === 1 ? filters[0] : { $and: filters };
}

function normalizeCategory(category: unknown): PlaceCategory {
  if (typeof category !== "string") {
    return "other";
  }

  const normalized = category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return supportedCategoryIds.has(normalized as PlaceCategory) && normalized !== "all"
    ? (normalized as PlaceCategory)
    : "other";
}

function extractCoordinates(doc: PlaceDocument): Coordinates | null {
  const geoCoordinates = toCoordinatePair(doc.location?.coordinates);

  if (geoCoordinates) {
    return geoCoordinates;
  }

  const coordinates = toCoordinatePair(doc.coordinates);

  if (coordinates) {
    return coordinates;
  }

  return toCoordinatesFromValues(doc.longitude ?? doc.lng ?? doc.x ?? doc.X, doc.latitude ?? doc.lat ?? doc.y ?? doc.Y);
}

function toCoordinatePair(value: unknown): Coordinates | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  return toCoordinatesFromValues(value[0], value[1]);
}

function toCoordinatesFromValues(longitude: unknown, latitude: unknown): Coordinates | null {
  const lon = toNumber(longitude, Number.NaN);
  const lat = toNumber(latitude, Number.NaN);

  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    return null;
  }

  return [lon, lat];
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80);
}
