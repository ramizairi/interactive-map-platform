import { NextRequest } from "next/server";
import { getSessionCookieName, getUserBySessionToken } from "@/lib/auth";
import { uploadImageToImgBb } from "@/lib/imgbb";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const user = token ? await getUserBySessionToken(token) : null;

  if (!user) {
    return Response.json({ error: "Sign in to upload images." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");

  if (!(file instanceof File)) {
    return Response.json({ error: "Image file is required." }, { status: 400 });
  }

  try {
    const image = await uploadImageToImgBb(file);
    return Response.json({ image });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Image upload failed." }, { status: 400 });
  }
}
