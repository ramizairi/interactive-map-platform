"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, UserRound } from "lucide-react";
import type { PublicUser } from "@/types/auth";
import { uploadImage } from "@/services/uploads.service";

export function ProfileEditor({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isUploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          username: formData.get("username"),
          bio: formData.get("bio"),
          avatarUrl,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Could not update profile.");
      }

      setMessage("Profile updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-black/10 bg-white/86 p-5 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex items-start gap-4">
        <div className="relative h-[72px] w-[72px] overflow-hidden rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="72px" unoptimized className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UserRound size={30} />
            </div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold">Manage profile</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Update the public profile visitors see when they open your contributor page.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="name" label="Name" defaultValue={user.name} />
          <Field name="username" label="Username" defaultValue={user.username} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">Profile photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={async (event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];

              if (file) {
                setError(null);
                setUploadingAvatar(true);

                try {
                  const image = await uploadImage(file);
                  setAvatarUrl(image.url || "");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Profile image upload failed.");
                } finally {
                  setUploadingAvatar(false);
                  input.value = "";
                }
              }
            }}
            className="block w-full rounded-lg border border-dashed border-zinc-300 bg-white/70 p-3 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:file:bg-white dark:file:text-zinc-950"
          />
          {isUploadingAvatar ? (
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <Loader2 size={15} className="animate-spin" />
              Uploading profile photo to ImgBB...
            </p>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">Bio</span>
          <textarea
            name="bio"
            defaultValue={user.bio || ""}
            rows={3}
            maxLength={240}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-50"
          />
        </label>
      </div>

      {message ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-400/10 dark:text-orange-200">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || isUploadingAvatar}
        className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950"
      >
        {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        Save profile
      </button>
    </form>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required
        className="h-11 w-full rounded-lg border border-zinc-200 bg-white/80 px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-50"
      />
    </label>
  );
}
