"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { RatingStars } from "@/components/reviews/RatingStars";
import type { CreateReviewInput } from "@/types/places";

interface ReviewFormProps {
  onSubmit: (input: CreateReviewInput) => Promise<void>;
}

export function ReviewForm({ onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (comment.trim().length < 2) {
      setError("Add a short comment before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        rating,
        authorName: authorName.trim() || undefined,
        comment: comment.trim(),
      });
      setAuthorName("");
      setComment("");
      setRating(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Your rating</span>
        <RatingStars value={rating} onChange={setRating} />
      </div>
      <input
        value={authorName}
        onChange={(event) => setAuthorName(event.target.value)}
        maxLength={80}
        placeholder="Name (optional)"
        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
      />
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={1200}
        placeholder="Share what stood out..."
        rows={3}
        className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
      />
      {error ? <p className="text-sm text-orange-700 dark:text-orange-300">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send size={16} />
        {isSubmitting ? "Saving..." : "Add review"}
      </button>
    </form>
  );
}
