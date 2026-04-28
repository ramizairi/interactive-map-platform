import { NextRequest } from "next/server";
import { getSessionCookieName, getUserBySessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const user = token ? await getUserBySessionToken(token) : null;
  return Response.json({ user });
}
