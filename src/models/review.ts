import "server-only";

import type { Document, ObjectId } from "mongodb";
import type { Review } from "@/types/places";

export interface ReviewDocument extends Document {
  _id?: ObjectId | string;
  placeId: ObjectId | string;
  userId?: string;
  authorName?: string;
  rating?: unknown;
  comment?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export function normalizeReview(doc: ReviewDocument): Review | null {
  if (!doc._id || typeof doc.comment !== "string") {
    return null;
  }

  const rating = typeof doc.rating === "number" ? doc.rating : Number(doc.rating);

  if (!Number.isFinite(rating)) {
    return null;
  }

  return {
    id: String(doc._id),
    placeId: String(doc.placeId),
    userId: doc.userId,
    authorName: doc.authorName,
    rating,
    comment: doc.comment,
    createdAt: toIsoDate(doc.createdAt),
    updatedAt: toIsoDate(doc.updatedAt),
  };
}

function toIsoDate(value: Date | string | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}
