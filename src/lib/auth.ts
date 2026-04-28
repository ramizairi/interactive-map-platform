import "server-only";

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { ObjectId, type Collection, type Document, type Filter } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import type { PublicUser, UserRole } from "@/types/auth";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "nabeul_session";
const SESSION_DAYS = 30;

interface UserDocument extends Document {
  _id?: ObjectId;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  bio?: string;
  avatarUrl?: string;
  stats?: {
    visitors?: number;
    placesAdded?: number;
    reviews?: number;
    reactions?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface SessionDocument extends Document {
  _id?: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: PublicUser;
  token?: string;
}

export async function createUserAccount(input: {
  name: string;
  username: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const name = input.name.trim().slice(0, 80);
  const username = normalizeUsername(input.username || input.name);
  const email = input.email.trim().toLowerCase();

  if (name.length < 2) {
    return { ok: false, error: "Name must be at least 2 characters." };
  }

  if (!username || username.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const db = await getMongoDb();
  const users = db.collection<UserDocument>(process.env.MONGODB_USERS_COLLECTION || "users");
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ username: 1 }, { unique: true });

  const existing = await users.findOne({ $or: [{ email }, { username }] });

  if (existing) {
    return { ok: false, error: existing.email === email ? "Email is already registered." : "Username is taken." };
  }

  const now = new Date();
  const userCount = await users.estimatedDocumentCount();
  const role: UserRole = isConfiguredAdminEmail(email) || (!process.env.ADMIN_EMAIL && userCount === 0) ? "admin" : "user";
  const passwordHash = await hashPassword(input.password);
  const result = await users.insertOne({
    name,
    username,
    email,
    passwordHash,
    role,
    stats: {
      visitors: 0,
      placesAdded: 0,
      reviews: 0,
      reactions: 0,
    },
    createdAt: now,
    updatedAt: now,
  });
  const user = await users.findOne({ _id: result.insertedId });

  if (!user) {
    return { ok: false, error: "Could not create account." };
  }

  const syncedUser = await syncUserRoleFromEnv(users, user);
  const token = await createSession(result.insertedId);
  return { ok: true, user: toPublicUser(syncedUser, true), token };
}

export async function signInUser(email: string, password: string): Promise<AuthResult> {
  const db = await getMongoDb();
  const users = db.collection<UserDocument>(process.env.MONGODB_USERS_COLLECTION || "users");
  const user = await users.findOne({ email: email.trim().toLowerCase() });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Invalid email or password." };
  }

  const syncedUser = await syncUserRoleFromEnv(users, user);
  const token = await createSession(user._id);
  return { ok: true, user: toPublicUser(syncedUser, true), token };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token ? getUserBySessionToken(token) : null;
}

export async function getUserBySessionToken(token: string) {
  const db = await getMongoDb();
  const sessions = db.collection<SessionDocument>(process.env.MONGODB_SESSIONS_COLLECTION || "sessions");
  const users = db.collection<UserDocument>(process.env.MONGODB_USERS_COLLECTION || "users");
  const session = await sessions.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    return null;
  }

  const user = await users.findOne({ _id: session.userId });

  if (!user) {
    return null;
  }

  return toPublicUser(await syncUserRoleFromEnv(users, user), true);
}

export async function deleteSession(token: string) {
  const db = await getMongoDb();
  await db.collection<SessionDocument>(process.env.MONGODB_SESSIONS_COLLECTION || "sessions").deleteOne({
    tokenHash: hashToken(token),
  });
}

export async function getPublicProfile(username: string) {
  const db = await getMongoDb();
  const users = db.collection<UserDocument>(process.env.MONGODB_USERS_COLLECTION || "users");
  const normalized = normalizeUsername(username);
  const user = await users.findOneAndUpdate(
    { username: normalized },
    { $inc: { "stats.visitors": 1 } },
    { returnDocument: "after" },
  );

  return user ? toPublicUser(user, false) : null;
}

export async function findUserById(id: string) {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const db = await getMongoDb();
  const user = await db
    .collection<UserDocument>(process.env.MONGODB_USERS_COLLECTION || "users")
    .findOne({ _id: new ObjectId(id) });
  return user ? toPublicUser(user, true) : null;
}

export async function updateUserProfile(
  userId: string,
  input: {
    name?: string;
    username?: string;
    bio?: string;
    avatarUrl?: string;
  },
) {
  if (!ObjectId.isValid(userId)) {
    throw new Error("Invalid user.");
  }

  const db = await getMongoDb();
  const users = db.collection<UserDocument>(process.env.MONGODB_USERS_COLLECTION || "users");
  const update: Partial<Pick<UserDocument, "name" | "username" | "bio" | "avatarUrl" | "updatedAt">> = {
    updatedAt: new Date(),
  };

  if (typeof input.name === "string") {
    const name = input.name.trim().slice(0, 80);

    if (name.length < 2) {
      throw new Error("Name must be at least 2 characters.");
    }

    update.name = name;
  }

  if (typeof input.username === "string") {
    const username = normalizeUsername(input.username);

    if (username.length < 3) {
      throw new Error("Username must be at least 3 characters.");
    }

    const existing = await users.findOne({ username, _id: { $ne: new ObjectId(userId) } });

    if (existing) {
      throw new Error("Username is taken.");
    }

    update.username = username;
  }

  if (typeof input.bio === "string") {
    update.bio = input.bio.trim().slice(0, 240);
  }

  if (typeof input.avatarUrl === "string" && input.avatarUrl) {
    update.avatarUrl = input.avatarUrl;
  }

  const result = await users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: update },
    { returnDocument: "after" },
  );

  if (!result) {
    throw new Error("User not found.");
  }

  return toPublicUser(result, true);
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function userIdFilter(id: string): Filter<Document> | null {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : null;
}

async function createSession(userId: ObjectId) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = await getMongoDb();
  const sessions = db.collection<SessionDocument>(process.env.MONGODB_SESSIONS_COLLECTION || "sessions");
  await sessions.createIndex({ tokenHash: 1 }, { unique: true });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await sessions.insertOne({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    createdAt: now,
  });
  return token;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function toPublicUser(user: UserDocument, includeEmail: boolean): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    email: includeEmail ? user.email : undefined,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    role: user.role || "user",
    stats: {
      visitors: user.stats?.visitors || 0,
      placesAdded: user.stats?.placesAdded || 0,
      reviews: user.stats?.reviews || 0,
      reactions: user.stats?.reactions || 0,
    },
    createdAt: user.createdAt.toISOString(),
  };
}

async function syncUserRoleFromEnv(users: Collection<UserDocument>, user: UserDocument) {
  const expectedRole: UserRole = isConfiguredAdminEmail(user.email) ? "admin" : user.role || "user";

  if (user.role === expectedRole) {
    return user;
  }

  await users.updateOne({ _id: user._id }, { $set: { role: expectedRole, updatedAt: new Date() } });
  return { ...user, role: expectedRole };
}

function isConfiguredAdminEmail(email: string) {
  const configuredEmails = (process.env.ADMIN_EMAIL || "")
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return configuredEmails.includes(email.trim().toLowerCase());
}
