export async function uploadImage(file: File) {
  const formData = new FormData();
  formData.set("image", file);

  const response = await fetch("/api/uploads/imgbb", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as {
    image?: {
      url?: string;
      thumbnailUrl?: string;
    };
    error?: string;
  } | null;

  if (!response.ok || !payload?.image?.url) {
    throw new Error(payload?.error || "Image upload failed.");
  }

  return payload.image;
}
