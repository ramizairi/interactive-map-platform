import "server-only";

interface ImgBbResponse {
  success: boolean;
  data?: {
    url?: string;
    display_url?: string;
    thumb?: {
      url?: string;
    };
    delete_url?: string;
  };
  error?: {
    message?: string;
  };
}

export async function uploadImageToImgBb(file: File) {
  const apiKey = process.env.IMGBB_API_KEY;

  if (!apiKey) {
    throw new Error("IMGBB_API_KEY is not configured.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be uploaded.");
  }

  if (file.size > 5_000_000) {
    throw new Error("Image must be smaller than 5 MB.");
  }

  const formData = new FormData();
  formData.set("image", file);
  formData.set("name", file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "map-upload");

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as ImgBbResponse | null;

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error?.message || "ImgBB upload failed.");
  }

  return {
    url: payload.data.display_url || payload.data.url || "",
    thumbnailUrl: payload.data.thumb?.url,
    deleteUrl: payload.data.delete_url,
  };
}
