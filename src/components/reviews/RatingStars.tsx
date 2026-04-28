"use client";

import { Star } from "lucide-react";

interface RatingStarsProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md";
  label?: string;
}

export function RatingStars({ value, onChange, size = "md", label = "Rating" }: RatingStarsProps) {
  const starSize = size === "sm" ? 16 : 22;
  const rounded = Math.round(value);

  return (
    <div className="flex items-center gap-1" aria-label={`${label}: ${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((rating) => {
        const active = rating <= rounded;
        const Icon = (
          <Star
            key={rating}
            size={starSize}
            className={active ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-600"}
            strokeWidth={active ? 1.5 : 1.8}
          />
        );

        if (!onChange) {
          return Icon;
        }

        return (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className="rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={`Set rating to ${rating}`}
          >
            {Icon}
          </button>
        );
      })}
    </div>
  );
}
