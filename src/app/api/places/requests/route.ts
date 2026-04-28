import { NextRequest } from "next/server";
import { getSessionCookieName, getUserBySessionToken } from "@/lib/auth";
import { createPendingPlaceRequest } from "@/lib/place-requests";
import { getMongoErrorMessage } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user) {
    return Response.json({ error: "Sign in to submit a place." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    category?: string;
    description?: string;
    address?: string;
    region?: string;
    longitude?: unknown;
    latitude?: unknown;
    images?: unknown;
  } | null;

  try {
    const id = await createPendingPlaceRequest({
      user,
      name: body?.name || "",
      category: body?.category || "",
      description: body?.description,
      address: body?.address,
      region: body?.region || "Nabeul",
      longitude: Number(body?.longitude),
      latitude: Number(body?.latitude),
      images: Array.isArray(body?.images) ? body.images.filter((image): image is string => typeof image === "string") : [],
    });

    return Response.json({ id, status: "pending" }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 400 });
  }
}
