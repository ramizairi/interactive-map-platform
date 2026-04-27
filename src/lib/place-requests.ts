import "server-only";

import { ObjectId } from "mongodb";
import { verifyPlaceWithGemini } from "@/lib/gemini";
import { sendPlaceApprovedEmail } from "@/lib/mailer";
import { getMongoDb } from "@/lib/mongodb";
import type { PendingPlaceRequest, PlaceVerification, PublicUser } from "@/types/auth";
import type { PlaceCategory } from "@/types/places";
import { supportedCategoryIds } from "@/config/map";

interface PendingPlaceDocument {
  _id?: ObjectId;
  name: string;
  category: PlaceCategory;
  description?: string;
  address?: string;
  region: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  images: string[];
  status: "pending" | "approved" | "rejected";
  submittedBy: ObjectId;
  submittedByUsername: string;
  aiVerification?: PlaceVerification;
  createdAt: Date;
  updatedAt: Date;
}

interface UserEmailDocument {
  _id?: ObjectId;
  name?: string;
  email?: string;
}

export async function createPendingPlaceRequest(input: {
  user: PublicUser;
  name: string;
  category: string;
  description?: string;
  address?: string;
  region: string;
  longitude: number;
  latitude: number;
  images: string[];
}) {
  const category = normalizeCategory(input.category);

  if (!input.name.trim() || !category || !Number.isFinite(input.longitude) || !Number.isFinite(input.latitude)) {
    throw new Error("Place name, category, and valid coordinates are required.");
  }

  const db = await getMongoDb();
  const now = new Date();
  const requestDocument: PendingPlaceDocument = {
    name: input.name.trim().slice(0, 120),
    category,
    description: input.description?.trim().slice(0, 800) || undefined,
    address: input.address?.trim().slice(0, 160) || undefined,
    region: input.region.trim() || "Nabeul",
    location: {
      type: "Point",
      coordinates: [input.longitude, input.latitude],
    },
    images: input.images.slice(0, 8),
    status: "pending",
    submittedBy: new ObjectId(input.user.id),
    submittedByUsername: input.user.username,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db
    .collection<PendingPlaceDocument>(process.env.MONGODB_PLACE_REQUESTS_COLLECTION || "placeRequests")
    .insertOne(requestDocument);

  await verifyPlaceRequest(result.insertedId.toString()).catch((error) => {
    console.warn(`[gemini] Pending place verification failed: ${error instanceof Error ? error.message : "unknown error"}`);
  });

  return result.insertedId.toString();
}

export async function listUserPlaceRequests(userId: string) {
  if (!ObjectId.isValid(userId)) {
    return [];
  }

  const db = await getMongoDb();
  const docs = await db
    .collection<PendingPlaceDocument>(process.env.MONGODB_PLACE_REQUESTS_COLLECTION || "placeRequests")
    .find({ submittedBy: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  return docs.map(toPendingPlaceRequest);
}

export async function listPendingPlaceRequests() {
  const db = await getMongoDb();
  const docs = await db
    .collection<PendingPlaceDocument>(process.env.MONGODB_PLACE_REQUESTS_COLLECTION || "placeRequests")
    .find({ status: "pending" })
    .sort({ createdAt: 1 })
    .limit(100)
    .toArray();

  return docs.map(toPendingPlaceRequest);
}

export async function approvePlaceRequest(id: string) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid request id.");
  }

  const db = await getMongoDb();
  const requests = db.collection<PendingPlaceDocument>(process.env.MONGODB_PLACE_REQUESTS_COLLECTION || "placeRequests");
  const request = await requests.findOne({ _id: new ObjectId(id), status: "pending" });

  if (!request) {
    throw new Error("Pending place request not found.");
  }

  const now = new Date();
  await db.collection(process.env.MONGODB_PLACES_COLLECTION || "places").insertOne({
    name: request.name,
    category: request.category,
    description: request.description,
    images: request.images,
    address: request.address,
    region: request.region,
    location: request.location,
    avgRating: 0,
    reviewsCount: 0,
    isActive: true,
    createdBy: request.submittedBy,
    createdAt: now,
    updatedAt: now,
  });
  await requests.updateOne({ _id: request._id }, { $set: { status: "approved", updatedAt: now } });
  await db
    .collection(process.env.MONGODB_USERS_COLLECTION || "users")
    .updateOne({ _id: request.submittedBy }, { $inc: { "stats.placesAdded": 1 } });

  const submitter = await db
    .collection<UserEmailDocument>(process.env.MONGODB_USERS_COLLECTION || "users")
    .findOne({ _id: request.submittedBy }, { projection: { name: 1, email: 1 } });

  await sendPlaceApprovedEmail({
    to: submitter?.email,
    userName: submitter?.name || request.submittedByUsername,
    placeName: request.name,
  });
}

export async function verifyPlaceRequest(id: string) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid request id.");
  }

  const db = await getMongoDb();
  const requests = db.collection<PendingPlaceDocument>(process.env.MONGODB_PLACE_REQUESTS_COLLECTION || "placeRequests");
  const request = await requests.findOne({ _id: new ObjectId(id), status: "pending" });

  if (!request) {
    throw new Error("Pending place request not found.");
  }

  const verification = await verifyPlaceWithGemini(toPendingPlaceRequest(request));
  await requests.updateOne(
    { _id: request._id },
    {
      $set: {
        aiVerification: verification,
        updatedAt: new Date(),
      },
    },
  );

  return verification;
}

export async function approvePlaceRequestWithVerification(id: string) {
  const verification = await verifyPlaceRequest(id);

  if (verification.recommendation !== "approve") {
    throw new Error(`Gemini recommends ${verification.recommendation}. Review the request manually before approving.`);
  }

  await approvePlaceRequest(id);
  return verification;
}

export async function rejectPlaceRequest(id: string) {
  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid request id.");
  }

  const db = await getMongoDb();
  await db
    .collection<PendingPlaceDocument>(process.env.MONGODB_PLACE_REQUESTS_COLLECTION || "placeRequests")
    .updateOne({ _id: new ObjectId(id), status: "pending" }, { $set: { status: "rejected", updatedAt: new Date() } });
}

function normalizeCategory(category: string): PlaceCategory | null {
  const normalized = category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return supportedCategoryIds.has(normalized as PlaceCategory) && normalized !== "all" ? (normalized as PlaceCategory) : null;
}

function toPendingPlaceRequest(doc: PendingPlaceDocument): PendingPlaceRequest {
  return {
    id: String(doc._id),
    name: doc.name,
    category: doc.category,
    description: doc.description,
    address: doc.address,
    region: doc.region,
    coordinates: doc.location.coordinates,
    images: doc.images,
    status: doc.status,
    submittedBy: String(doc.submittedBy),
    submittedByUsername: doc.submittedByUsername,
    aiVerification: doc.aiVerification,
    createdAt: doc.createdAt.toISOString(),
  };
}
