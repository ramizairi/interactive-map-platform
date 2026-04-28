import { NextRequest } from "next/server";
import { getSessionCookieName, getUserBySessionToken } from "@/lib/auth";
import {
  approvePlaceRequest,
  approvePlaceRequestWithVerification,
  rejectPlaceRequest,
  verifyPlaceRequest,
} from "@/lib/place-requests";
import { getMongoErrorMessage } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user || user.role !== "admin") {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { id?: string; action?: string } | null;

  try {
    if (body?.action === "approve" && body.id) {
      await approvePlaceRequest(body.id);
      return Response.json({ ok: true });
    }

    if (body?.action === "verify" && body.id) {
      const verification = await verifyPlaceRequest(body.id);
      return Response.json({ ok: true, verification });
    }

    if (body?.action === "ai-approve" && body.id) {
      const verification = await approvePlaceRequestWithVerification(body.id);
      return Response.json({ ok: true, verification });
    }

    if (body?.action === "reject" && body.id) {
      await rejectPlaceRequest(body.id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Invalid moderation action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 400 });
  }
}
