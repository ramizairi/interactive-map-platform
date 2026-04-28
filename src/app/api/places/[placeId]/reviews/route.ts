import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { getSessionCookieName, getUserBySessionToken } from "@/lib/auth";
import { getMongoDb, getMongoErrorMessage, isMongoConfigured } from "@/lib/mongodb";
import { normalizeReview, type ReviewDocument } from "@/models/review";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    placeId: string;
  }>;
};

export async function GET(_request: NextRequest, context: Context) {
  const { placeId } = await context.params;

  if (!isMongoConfigured()) {
    return Response.json({
      reviews: [],
      meta: {
        isConfigured: false,
        count: 0,
      },
    });
  }

  try {
    const db = await getMongoDb();
    const reviewsCollection = db.collection<ReviewDocument>(process.env.MONGODB_REVIEWS_COLLECTION || "reviews");
    const docs = await reviewsCollection
      .find(buildPlaceIdMatch(placeId), { limit: 50 })
      .sort({ createdAt: -1 })
      .toArray();
    const reviews = docs.map(normalizeReview).filter(Boolean);

    return Response.json({
      reviews,
      meta: {
        isConfigured: true,
        count: reviews.length,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: getMongoErrorMessage(error),
        reviews: [],
        meta: {
          isConfigured: true,
          count: 0,
        },
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  const { placeId } = await context.params;

  if (!isMongoConfigured()) {
    return Response.json({ error: "MONGODB_URI is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    rating?: unknown;
    comment?: unknown;
    authorName?: unknown;
    userId?: unknown;
  } | null;
  const token = request.cookies.get(getSessionCookieName())?.value;
  const user = token ? await getUserBySessionToken(token) : null;
  const rating = Number(body?.rating);
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  const authorName = user?.name || (typeof body?.authorName === "string" ? body.authorName.trim().slice(0, 80) : undefined);
  const userId =
    user?.id ||
    (typeof body?.userId === "string"
      ? body.userId.trim().slice(0, 120)
      : request.headers.get("x-user-id")?.trim().slice(0, 120) || undefined);

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  }

  if (comment.length < 2 || comment.length > 1200) {
    return Response.json({ error: "Comment must be between 2 and 1200 characters." }, { status: 400 });
  }

  try {
    const db = await getMongoDb();
    const reviewsCollection = db.collection<ReviewDocument>(process.env.MONGODB_REVIEWS_COLLECTION || "reviews");
    const placesCollection = db.collection(process.env.MONGODB_PLACES_COLLECTION || "places");
    const now = new Date();
    const storedPlaceId = toStoredPlaceId(placeId);

    const result = await reviewsCollection.insertOne({
      placeId: storedPlaceId,
      userId,
      authorName,
      rating,
      comment,
      createdAt: now,
      updatedAt: now,
    });

    const [stats] = await reviewsCollection
      .aggregate<{ avgRating: number; reviewsCount: number }>([
        { $match: buildPlaceIdMatch(placeId) },
        {
          $group: {
            _id: "$placeId",
            avgRating: { $avg: "$rating" },
            reviewsCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    if (stats && ObjectId.isValid(placeId)) {
      await placesCollection.updateOne(
        { _id: new ObjectId(placeId) },
        {
          $set: {
            avgRating: Math.round(stats.avgRating * 10) / 10,
            reviewsCount: stats.reviewsCount,
            updatedAt: now,
          },
        },
      );
    }

    if (user && ObjectId.isValid(user.id)) {
      await db
        .collection(process.env.MONGODB_USERS_COLLECTION || "users")
        .updateOne({ _id: new ObjectId(user.id) }, { $inc: { "stats.reviews": 1 } });
    }

    const review = normalizeReview({
      _id: result.insertedId,
      placeId: storedPlaceId,
      userId,
      authorName,
      rating,
      comment,
      createdAt: now,
      updatedAt: now,
    });

    return Response.json({ review }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 503 });
  }
}

function buildPlaceIdMatch(placeId: string) {
  if (!ObjectId.isValid(placeId)) {
    return { placeId };
  }

  return {
    $or: [{ placeId: new ObjectId(placeId) }, { placeId }],
  };
}

function toStoredPlaceId(placeId: string) {
  return ObjectId.isValid(placeId) ? new ObjectId(placeId) : placeId;
}
