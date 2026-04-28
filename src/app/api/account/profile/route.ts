import { NextRequest } from "next/server";
import { getSessionCookieName, getUserBySessionToken, updateUserProfile } from "@/lib/auth";
import { getMongoErrorMessage } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user) {
    return Response.json({ error: "Sign in to update your profile." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    username?: string;
    bio?: string;
    avatarUrl?: string;
  } | null;

  try {
    const updatedUser = await updateUserProfile(user.id, {
      name: body?.name,
      username: body?.username,
      bio: body?.bio,
      avatarUrl: body?.avatarUrl,
    });

    return Response.json({ user: updatedUser });
  } catch (error) {
    return Response.json({ error: getMongoErrorMessage(error) }, { status: 400 });
  }
}
