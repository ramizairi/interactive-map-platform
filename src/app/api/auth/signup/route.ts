import { NextRequest, NextResponse } from "next/server";
import { createUserAccount, getSessionCookieName, getSessionCookieOptions } from "@/lib/auth";
import { getMongoErrorMessage } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    username?: string;
    email?: string;
    password?: string;
  } | null;

  try {
    const result = await createUserAccount({
      name: body?.name || "",
      username: body?.username || "",
      email: body?.email || "",
      password: body?.password || "",
    });

    if (!result.ok || !result.token) {
      return Response.json({ error: result.error || "Could not create account." }, { status: 400 });
    }

    const response = NextResponse.json({ user: result.user }, { status: 201 });
    response.cookies.set(getSessionCookieName(), result.token, getSessionCookieOptions());
    return response;
  } catch (error) {
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 503 });
  }
}
