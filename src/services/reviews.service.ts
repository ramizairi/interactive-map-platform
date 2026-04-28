import type { CreateReviewInput, Review, ReviewsResponse } from "@/types/places";

export async function fetchReviews(placeId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/places/${placeId}/reviews`, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Unable to load reviews.");
  }

  return (await response.json()) as ReviewsResponse;
}

export async function createReview(placeId: string, input: CreateReviewInput) {
  const response = await fetch(`/api/places/${placeId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Unable to save review.");
  }

  return (await response.json()) as { review: Review };
}
