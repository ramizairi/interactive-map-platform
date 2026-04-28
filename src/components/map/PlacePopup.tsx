"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  ImagePlus,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  StickyNote,
  Star,
  X,
  ZoomIn,
} from "lucide-react";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ReviewList } from "@/components/reviews/ReviewList";
import { RatingStars } from "@/components/reviews/RatingStars";
import { addPlaceImages } from "@/services/places.service";
import { createReview, fetchReviews } from "@/services/reviews.service";
import { uploadImage } from "@/services/uploads.service";
import type { PublicUser } from "@/types/auth";
import type { CreateReviewInput, Place, Review } from "@/types/places";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Detail icons ─────────────────────────────────────────────────────────────

const detailIcons: Record<string, React.ReactNode> = {
  Hours:   <Clock size={13} className="shrink-0 text-zinc-400" />,
  Budget:  <DollarSign size={13} className="shrink-0 text-zinc-400" />,
  Contact: <Phone size={13} className="shrink-0 text-zinc-400" />,
  Notes:   <StickyNote size={13} className="shrink-0 text-zinc-400" />,
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  images: string[];
  initialIndex: number;
  placeName: string;
  onClose: () => void;
}

function Lightbox({ images, initialIndex, placeName, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + images.length) % images.length),
    [images.length],
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % images.length),
    [images.length],
  );

  // Keyboard navigation + close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  // Prevent body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    // Only trigger swipe if mostly horizontal (not a scroll)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={`Image gallery for ${placeName}`}
    >
      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-white/80">
          {index + 1} <span className="text-white/40">/</span> {images.length}
        </span>
        <p className="hidden max-w-[60%] truncate text-sm font-medium text-white/60 sm:block">
          {placeName}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close gallery"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Main image ── */}
      <div
        className="relative min-h-0 flex-1 select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Prev button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={prev}
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 active:scale-95 md:left-6"
            aria-label="Previous image"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Image */}
        <Image
          key={images[index]}
          src={images[index]}
          alt={`${placeName} — image ${index + 1}`}
          fill
          sizes="100vw"
          unoptimized
          className="object-contain"
          priority
        />

        {/* Next button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={next}
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 active:scale-95 md:right-6"
            aria-label="Next image"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* ── Thumbnail strip ── */}
      {images.length > 1 && (
        <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-3">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to image ${i + 1}`}
              className={[
                "relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200",
                i === index
                  ? "border-white opacity-100"
                  : "border-transparent opacity-40 hover:opacity-70",
              ].join(" ")}
            >
              <Image src={img} alt="" fill sizes="64px" unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Swipe hint on mobile (fades quickly) */}
      {images.length > 1 && (
        <p className="animate-fade-in absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm sm:hidden"
          style={{ animationDelay: "0.3s", animationDuration: "0.4s" }}
        >
          Swipe to navigate
        </p>
      )}
    </div>
  );
}

// ─── PlacePopup ───────────────────────────────────────────────────────────────

export function PlacePopup({ place, currentUser, onClose, onReviewAdded, onPlaceUpdated }: PlacePopupProps) {
  const placeId = place?.id || null;

  const [imageSelection, setImageSelection] = useState<{ placeId: string | null; index: number }>({
    placeId: null,
    index: 0,
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isUploadingImages, setUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<{ placeId: string; message: string } | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>({
    placeId: null,
    reviews: [],
    error: null,
  });

  useEffect(() => {
    if (!placeId) return;

    const controller = new AbortController();
    fetchReviews(placeId, controller.signal)
      .then((payload) => setReviewState({ placeId, reviews: payload.reviews, error: null }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setReviewState({
          placeId,
          reviews: [],
          error: error instanceof Error ? error.message : "Unable to load reviews.",
        });
      });

    return () => controller.abort();
  }, [placeId]);

  // Close lightbox when place changes
  useEffect(() => { setLightboxIndex(null); }, [placeId]);

  if (!place) return null;

  const images = place.images.filter(Boolean);
  const activeImageIndex =
    imageSelection.placeId === place.id
      ? Math.min(imageSelection.index, Math.max(images.length - 1, 0))
      : 0;
  const heroImage = images[activeImageIndex] || images[0];
  const ratingLabel = place.reviewsCount
    ? `${place.avgRating.toFixed(1)} · ${place.reviewsCount} reviews`
    : "No ratings yet";
  const reviews = reviewState.placeId === place.id ? reviewState.reviews : [];
  const reviewsError = reviewState.placeId === place.id ? reviewState.error : null;
  const isLoadingReviews = reviewState.placeId !== place.id && !reviewsError;
  const activeUploadError = uploadError?.placeId === place.id ? uploadError.message : null;
  const directionsUrl =
    place.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${place.location.coordinates[1]},${place.location.coordinates[0]}`;

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
    if (!place) return;
    const { review } = await createReview(place.id, input);
    const nextReviews = [review, ...reviews];
    setReviewState({ placeId: place.id, reviews: nextReviews, error: null });
    const avgRating = nextReviews.reduce((s, r) => s + r.rating, 0) / nextReviews.length;
    onReviewAdded(place.id, Math.round(avgRating * 10) / 10, nextReviews.length);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!place) return;
    const input = event.currentTarget;
    const files = Array.from(input.files || []).slice(0, 4);
    if (!files.length) return;
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
      setUploadError({
        placeId: place.id,
        message: err instanceof Error ? err.message : "Image upload failed.",
      });
    } finally {
      setUploadingImages(false);
      input.value = "";
    }
  }

  function openLightbox(index: number) {
    if (images.length > 0) setLightboxIndex(index);
  }

  return (
    <>
      {/* ── Lightbox (portal-like, rendered on top of everything) ── */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          initialIndex={lightboxIndex}
          placeName={place.name}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* ── Popup panel ── */}
      <aside className="animate-fade-slide-up absolute inset-x-3 bottom-3 z-30 flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white/88 shadow-[0_24px_72px_rgba(15,23,42,0.26),0_4px_16px_rgba(15,23,42,0.12)] backdrop-blur-[32px] saturate-150 dark:border-white/[0.07] dark:bg-zinc-950/88 md:inset-x-auto md:bottom-4 md:right-4 md:top-[140px] md:max-h-none md:w-[420px] lg:w-[440px]">

        {/* ── Hero image (click → lightbox) ── */}
        <div className="group relative shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900" style={{ height: 176 }}>
          {heroImage ? (
            <>
              <Image
                src={heroImage}
                alt=""
                fill
                sizes="(min-width: 768px) 440px, 100vw"
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {/* Click-to-open overlay */}
              <button
                type="button"
                onClick={() => openLightbox(activeImageIndex)}
                className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/25"
                aria-label="Open full-screen gallery"
              >
                <span className="flex h-10 w-10 scale-75 items-center justify-center rounded-full bg-white/90 text-zinc-800 opacity-0 shadow-lg backdrop-blur transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
                  <ZoomIn size={18} />
                </span>
              </button>
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top_left,rgba(16,143,114,0.28),transparent_50%),linear-gradient(135deg,#f0faf7,#e5ecea)] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(16,143,114,0.18),transparent_50%),linear-gradient(135deg,#101613,#1e2523)]">
              <MapPin size={36} className="text-emerald-600/60 dark:text-emerald-400/40" />
            </div>
          )}

          {/* Counter */}
          {images.length > 1 && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-xl">
              {activeImageIndex + 1} / {images.length}
            </div>
          )}

          {/* Gradient fade at bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/60 to-transparent dark:from-zinc-950/60" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xl transition hover:bg-black/60"
            aria-label="Close place details"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">

          {/* Thumbnail strip (click → lightbox on that image) */}
          {images.length > 1 && (
            <div className="-mt-2 mb-4 flex gap-1.5 overflow-x-auto pb-1">
              {images.map((image, index) => {
                const isActive = index === activeImageIndex;
                return (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => {
                      setImageSelection({ placeId: place.id, index });
                      openLightbox(index);
                    }}
                    className={[
                      "group/thumb relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200",
                      isActive
                        ? "border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]"
                        : "border-transparent opacity-60 hover:opacity-90",
                    ].join(" ")}
                    aria-label={`View image ${index + 1}`}
                  >
                    <Image src={image} alt="" fill sizes="80px" unoptimized className="object-cover" />
                    {/* Zoom hint on hover */}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover/thumb:bg-black/30">
                      <ZoomIn size={14} className="scale-75 text-white opacity-0 transition-all group-hover/thumb:scale-100 group-hover/thumb:opacity-100" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Title & category */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-300">
                  {place.category}
                </span>
                {place.city && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <MapPin size={11} />
                    {place.city}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50">
                {place.name}
              </h2>
              {place.address && (
                <p className="mt-1 text-sm leading-5 text-zinc-500 dark:text-zinc-400">{place.address}</p>
              )}
            </div>
          </div>

          {/* Rating + Directions + Call */}
          <div className={["mt-4 grid gap-2", place.contact ? "grid-cols-3" : "grid-cols-2"].join(" ")}>
            <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-white/[0.07] dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                {ratingLabel}
              </div>
              <RatingStars value={place.avgRating || 0} size="sm" />
            </div>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200/70 bg-zinc-50/80 p-3 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
            >
              <ExternalLink size={16} className="text-zinc-600 dark:text-zinc-400" />
              Directions
            </a>
            {place.contact && (
              <a
                href={`tel:${place.contact.replace(/\s+/g, "")}`}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-400/[0.15] dark:bg-emerald-400/[0.07] dark:text-emerald-300 dark:hover:bg-emerald-400/[0.12]"
              >
                <PhoneCall size={16} className="text-emerald-600 dark:text-emerald-400" />
                Call
              </a>
            )}
          </div>

          {/* Description */}
          {place.description && (
            <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{place.description}</p>
          )}

          {/* Detail rows */}
          {detailRows.length > 0 && (
            <dl className="mt-4 grid gap-2.5 rounded-xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-white/[0.07] dark:bg-white/[0.04]">
              {detailRows.map(([label, value]) => (
                <div key={label} className="flex items-start gap-2">
                  {detailIcons[label] || <span className="mt-0.5 h-3 w-3 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</dt>
                    <dd className="mt-0.5 text-sm leading-5 text-zinc-800 dark:text-zinc-200">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {/* Photos section */}
          <section className="mt-4 rounded-xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-white/[0.07] dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <ImagePlus size={14} />
                Photos
              </h3>
              {currentUser ? (
                <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100">
                  {isUploadingImages ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  {isUploadingImages ? "Uploading…" : "Upload"}
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
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  Sign in
                </Link>
              )}
            </div>
            {activeUploadError && (
              <p className="mt-2 text-xs font-medium text-orange-700 dark:text-orange-300">{activeUploadError}</p>
            )}
          </section>

          {/* Reviews */}
          <section className="mt-5 space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <MessageSquare size={14} />
              Reviews
            </h3>
            <ReviewForm onSubmit={handleReviewSubmit} />
            {reviewsError && (
              <div className="rounded-xl border border-orange-200/80 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-400/15 dark:bg-orange-400/8 dark:text-orange-200">
                {reviewsError}
              </div>
            )}
            <ReviewList reviews={reviews} isLoading={isLoadingReviews} />
          </section>
        </div>
      </aside>
    </>
  );
}
