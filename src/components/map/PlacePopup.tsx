"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, ImagePlus, Loader2, MapPin, MessageSquare, Star, X } from "lucide-react";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ReviewList } from "@/components/reviews/ReviewList";
import { RatingStars } from "@/components/reviews/RatingStars";
import { addPlaceImages } from "@/services/places.service";
import { createReview, fetchReviews } from "@/services/reviews.service";
import { uploadImage } from "@/services/uploads.service";
import type { PublicUser } from "@/types/auth";
import type { CreateReviewInput, Place, Review } from "@/types/places";

interface PlacePopupProps {
  place: Place | null;
  currentUser: PublicUser | null;
  onClose: () => void;
  onReviewAdded: (placeId: string, avgRating: number, reviewsCount: number) => void;
  onPlaceUpdated: (place: Place) => void;
}

interface ReviewState {
  placeId: string | null;
  reviews: Review[];
  error: string | null;
}

export function PlacePopup({ place, currentUser, onClose, onReviewAdded, onPlaceUpdated }: PlacePopupProps) {
  const placeId = place?.id || null;
  const [imageSelection, setImageSelection] = useState<{ placeId: string | null; index: number }>({
    placeId: null,
    index: 0,
  });
  const [isUploadingImages, setUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>({
    placeId: null,
    reviews: [],
    error: null,
  });

  useEffect(() => {
    if (!placeId) {
      return;
    }

    const controller = new AbortController();

    fetchReviews(placeId, controller.signal)
      .then((payload) =>
        setReviewState({
          placeId,
          reviews: payload.reviews,
          error: null,
        }),
      )
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setReviewState({
          placeId,
          reviews: [],
          error: error instanceof Error ? error.message : "Unable to load reviews.",
        });
      });

    return () => controller.abort();
  }, [placeId]);

  useEffect(() => {
    setUploadError(null);
  }, [placeId]);

  if (!place) {
    return null;
  }

  const images = place.images.filter(Boolean);
  const activeImageIndex =
    imageSelection.placeId === place.id ? Math.min(imageSelection.index, Math.max(images.length - 1, 0)) : 0;
  const heroImage = images[activeImageIndex] || images[0];
  const ratingLabel = place.reviewsCount ? `${place.avgRating.toFixed(1)} (${place.reviewsCount})` : "No ratings yet";
  const reviews = reviewState.placeId === place.id ? reviewState.reviews : [];
  const reviewsError = reviewState.placeId === place.id ? reviewState.error : null;
  const isLoadingReviews = reviewState.placeId !== place.id && !reviewsError;
  const directionsUrl =
    place.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${place.location.coordinates[1]},${place.location.coordinates[0]}`;
  const detailRows = [
    ["City", place.city],
    ["Zone", place.zone],
    ["Guide ID", place.sourceId],
    ["Type", place.subCategory || place.originalCategory],
    ["Specialties", place.specialties],
    ["Hours", place.hours],
    ["Budget", place.budget],
    ["Contact", place.contact],
    ["Notes", place.practicalNotes],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  async function handleReviewSubmit(input: CreateReviewInput) {
    if (!place) {
      return;
    }

    const { review } = await createReview(place.id, input);
    const nextReviews = [review, ...reviews];
    setReviewState({
      placeId: place.id,
      reviews: nextReviews,
      error: null,
    });

    const avgRating = nextReviews.reduce((sum, item) => sum + item.rating, 0) / nextReviews.length;
    onReviewAdded(place.id, Math.round(avgRating * 10) / 10, nextReviews.length);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!place) {
      return;
    }

    const input = event.currentTarget;
    const files = Array.from(input.files || []).slice(0, 4);

    if (!files.length) {
      return;
    }

    setUploadError(null);
    setUploadingImages(true);

    try {
      const uploaded = await Promise.all(files.map((file) => uploadImage(file)));
      const uploadedUrls = uploaded.map((image) => image.url || "").filter(Boolean);
      const updatedPlace = await addPlaceImages(place.id, uploadedUrls);
      onPlaceUpdated(updatedPlace);
      setImageSelection({
        placeId: updatedPlace.id,
        index: Math.max(updatedPlace.images.length - uploadedUrls.length, 0),
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingImages(false);
      input.value = "";
    }
  }

  return (
    <aside className="absolute inset-x-3 bottom-3 z-30 max-h-[76vh] overflow-hidden rounded-lg border border-black/10 bg-white/88 shadow-[0_24px_70px_rgba(15,23,42,0.24)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/88 md:inset-x-auto md:bottom-4 md:right-4 md:top-[136px] md:flex md:w-[410px] md:max-h-none md:flex-col lg:w-[430px]">
      <div className="relative h-40 overflow-hidden bg-zinc-100 dark:bg-zinc-900 md:h-48">
        {heroImage ? (
          <Image src={heroImage} alt="" fill sizes="(min-width: 768px) 400px, 100vw" unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(16,143,114,0.24),transparent_42%),linear-gradient(135deg,#f3f4f6,#dfe7e4)] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,143,114,0.2),transparent_44%),linear-gradient(135deg,#101413,#242b28)]">
            <MapPin size={32} className="text-emerald-700 dark:text-emerald-300" />
          </div>
        )}
        {images.length > 1 ? (
          <div className="absolute left-3 top-3 rounded-full bg-zinc-950/72 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-xl">
            {activeImageIndex + 1} / {images.length}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-white/92 p-2 text-zinc-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-zinc-950 dark:bg-zinc-950/80 dark:text-zinc-200 dark:hover:bg-zinc-900"
          aria-label="Close place details"
        >
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto p-4 md:flex-1">
        {images.length > 1 ? (
          <div className="-mt-1 mb-4 flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => {
              const isActive = index === activeImageIndex;

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setImageSelection({ placeId: place.id, index })}
                  className={[
                    "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border transition",
                    isActive
                      ? "border-emerald-500 ring-2 ring-emerald-500/25"
                      : "border-black/10 opacity-75 hover:opacity-100 dark:border-white/10",
                  ].join(" ")}
                  aria-label={`Show image ${index + 1}`}
                >
                  <Image src={image} alt="" fill sizes="80px" unoptimized className="object-cover" />
                </button>
              );
            })}
          </div>
        ) : null}

        <section className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <ImagePlus size={16} />
              Photos
            </h3>
            {currentUser ? (
              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
                {isUploadingImages ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                {isUploadingImages ? "Uploading" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isUploadingImages}
                  onChange={handleImageUpload}
                  className="sr-only"
                />
              </label>
            ) : (
              <Link
                href="/signin"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                Sign in
              </Link>
            )}
          </div>
          {uploadError ? <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">{uploadError}</p> : null}
        </section>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                {place.category}
              </span>
              <span className="text-xs font-medium text-zinc-500">{place.region}</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{place.name}</h2>
            {place.address ? (
              <p className="mt-1 flex items-start gap-1.5 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                {place.address}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Star size={16} className="fill-amber-400 text-amber-400" />
              {ratingLabel}
            </div>
            <div className="mt-2">
              <RatingStars value={place.avgRating || 0} size="sm" />
            </div>
          </div>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
          >
            <ExternalLink size={16} />
            Directions
          </a>
        </div>

        {place.description ? (
          <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{place.description}</p>
        ) : null}

        {detailRows.length ? (
          <dl className="mt-4 grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
            {detailRows.map(([label, value]) => (
              <div key={label} className="grid gap-0.5">
                <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</dt>
                <dd className="leading-5 text-zinc-800 dark:text-zinc-200">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <section className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <MessageSquare size={16} />
              Reviews
            </h3>
          </div>
          <ReviewForm onSubmit={handleReviewSubmit} />
          {reviewsError ? (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200">
              {reviewsError}
            </div>
          ) : null}
          <ReviewList reviews={reviews} isLoading={isLoadingReviews} />
        </section>
      </div>
    </aside>
  );
}
