import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, getSessionCookieOptions, signInUser } from "@/lib/auth";
import { getMongoErrorMessage } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  try {
    const result = await signInUser(body?.email || "", body?.password || "");

    if (!result.ok || !result.token) {
      return Response.json({ error: result.error || "Invalid credentials." }, { status: 401 });
    }

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(getSessionCookieName(), result.token, getSessionCookieOptions());
    return response;
  } catch (error) {
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 503 });
  }
}
