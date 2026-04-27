import { ObjectId, type Filter } from "mongodb";
import { NextRequest } from "next/server";
import { getSessionCookieName, getUserBySessionToken } from "@/lib/auth";
import { getMongoDb, getMongoErrorMessage, isMongoConfigured } from "@/lib/mongodb";
import { normalizePlace, type PlaceDocument } from "@/models/place";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    placeId: string;
  }>;
};

export async function POST(request: NextRequest, context: Context) {
  const { placeId } = await context.params;

  if (!isMongoConfigured()) {
    return Response.json({ error: "MONGODB_URI is not configured." }, { status: 503 });
  }

  const token = request.cookies.get(getSessionCookieName())?.value;
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user) {
    return Response.json({ error: "Sign in to add images to this place." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { images?: unknown } | null;
  const images = Array.isArray(body?.images)
    ? body.images
        .filter((image): image is string => typeof image === "string")
        .map((image) => image.trim())
        .filter(isAllowedImageUrl)
        .slice(0, 8)
    : [];

  if (!images.length) {
    return Response.json({ error: "At least one valid image URL is required." }, { status: 400 });
  }

  try {
    const db = await getMongoDb();
    const collection = db.collection<PlaceDocument>(process.env.MONGODB_PLACES_COLLECTION || "places");
    const now = new Date();
    const result = await collection.findOneAndUpdate(
      buildPlaceIdMatch(placeId),
      {
        $addToSet: {
          images: { $each: images },
        },
        $set: {
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
      },
    );

    const place = result ? normalizePlace(result) : null;

    if (!place) {
      return Response.json({ error: "Place not found." }, { status: 404 });
    }

    return Response.json({ place });
  } catch (error) {
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 503 });
  }
}

function buildPlaceIdMatch(placeId: string): Filter<PlaceDocument> {
  if (!ObjectId.isValid(placeId)) {
    return { _id: placeId };
  }

  return {
    $or: [{ _id: new ObjectId(placeId) }, { _id: placeId }],
  };
}

function isAllowedImageUrl(value: string) {
  if (value.length > 1000) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
