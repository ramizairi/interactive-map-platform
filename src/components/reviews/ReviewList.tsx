"use client";

import type { Review } from "@/types/places";
import { RatingStars } from "@/components/reviews/RatingStars";

interface ReviewListProps {
  reviews: Review[];
  isLoading: boolean;
}

export function ReviewList({ reviews, isLoading }: ReviewListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-zinc-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
            <div className="h-3 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (!reviews.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white/60 p-4 text-sm text-zinc-600 dark:border-white/15 dark:bg-white/5 dark:text-zinc-400">
        No reviews yet. Be the first to add a rating for this place.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <article
          key={review.id}
          className="rounded-lg border border-zinc-200/80 bg-white/75 p-3 shadow-sm dark:border-white/10 dark:bg-white/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{review.authorName || "Guest"}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">{formatDate(review.createdAt)}</p>
            </div>
            <RatingStars value={review.rating} size="sm" />
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.comment}</p>
        </article>
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
