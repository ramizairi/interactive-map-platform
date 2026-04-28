"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Send } from "lucide-react";
import { mapConfig } from "@/config/map";
import { uploadImage } from "@/services/uploads.service";

export function AddPlaceForm({
  coordinates,
  onSubmitted,
}: {
  coordinates: {
    longitude: number;
    latitude: number;
  };
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isUploadingImages, setUploadingImages] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const images = String(formData.get("images") || "")
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean);

    const payload = {
      name: formData.get("name"),
      category: formData.get("category"),
      description: formData.get("description"),
      address: formData.get("address"),
      longitude: formData.get("longitude"),
      latitude: formData.get("latitude"),
      images: [...uploadedImages, ...images].slice(0, 8),
    };

    try {
      const response = await fetch("/api/places/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Could not submit place.");
      }

      event.currentTarget.reset();
      setUploadedImages([]);
      setMessage("Place submitted for admin approval.");
      onSubmitted?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit place.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-black/10 bg-white/84 p-5 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/82">
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="name" label="Place name" />
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">Category</span>
          <select
            name="category"
            required
            className="h-11 w-full rounded-lg border border-zinc-200 bg-white/80 px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-50"
          >
            {mapConfig.categories
              .filter((category) => category.id !== "all")
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
          </select>
        </label>
        <Field name="longitude" label="Longitude" type="number" step="any" value={coordinates.longitude} readOnly />
        <Field name="latitude" label="Latitude" type="number" step="any" value={coordinates.latitude} readOnly />
      </div>
      <Field name="address" label="Address" />
      <TextArea name="description" label="Description" rows={4} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">Upload images</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={async (event) => {
            const input = event.currentTarget;
            const files = Array.from(input.files || []).slice(0, 4);

            if (!files.length) {
              return;
            }

            setError(null);
            setUploadingImages(true);

            try {
              const uploaded = await Promise.all(files.map((file) => uploadImage(file)));
              setUploadedImages((current) => [...current, ...uploaded.map((image) => image.url || "")].filter(Boolean).slice(0, 8));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Image upload failed.");
            } finally {
              setUploadingImages(false);
              input.value = "";
            }
          }}
          className="block w-full rounded-lg border border-dashed border-zinc-300 bg-white/70 p-3 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:file:bg-white dark:file:text-zinc-950"
        />
        {isUploadingImages ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <Loader2 size={15} className="animate-spin" />
            Uploading to ImgBB...
          </p>
        ) : null}
        {uploadedImages.length ? (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {uploadedImages.map((image, index) => (
              <div key={image} className="group relative">
                <Image
                  src={image}
                  alt={`Upload preview ${index + 1}`}
                  width={120}
                  height={80}
                  unoptimized
                  className="h-20 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setUploadedImages((current) => current.filter((item) => item !== image))}
                  className="absolute right-1 top-1 rounded-md bg-zinc-950/80 px-1.5 py-0.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </label>
      <TextArea name="images" label="Image URLs, one per line" rows={3} />

      {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">{message}</p> : null}
      {error ? <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-400/10 dark:text-orange-200">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || isUploadingImages}
        className="flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950"
      >
        {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : isUploadingImages ? <ImageUp size={17} /> : <Send size={17} />}
        Submit for approval
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  step,
  defaultValue,
  value,
  readOnly,
}: {
  name: string;
  label: string;
  type?: string;
  step?: string;
  defaultValue?: string;
  value?: string | number;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        value={value}
        readOnly={readOnly}
        required={["name", "longitude", "latitude", "region"].includes(name)}
        className="h-11 w-full rounded-lg border border-zinc-200 bg-white/80 px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 read-only:bg-zinc-100 read-only:text-zinc-600 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-50 dark:read-only:bg-white/10"
      />
    </label>
  );
}

function TextArea({ name, label, rows }: { name: string; label: string; rows: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
      <textarea
        name={name}
        rows={rows}
        className="w-full resize-none rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-50"
      />
    </label>
  );
}
