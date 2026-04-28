"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Database, Loader2, Lock, MapPinned, MousePointer2, Plus, X } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { brand } from "@/config/brand";
import { mapConfig, type RegionDefinition } from "@/config/map";
import { configureMapbox, getPreferredMapStyle, isMapboxConfigured } from "@/lib/mapbox";
import { fetchPlaces } from "@/services/places.service";
import type { PublicUser } from "@/types/auth";
import type { Place } from "@/types/places";
import type { SearchSuggestion } from "@/types/search";
import { AddPlaceForm } from "@/components/account/AddPlaceForm";
import { CategoryFilter } from "@/components/map/CategoryFilter";
import { AuthConnect } from "@/components/map/AuthConnect";
import { MapSearch } from "@/components/map/MapSearch";
import { PlaceMarker } from "@/components/map/PlaceMarker";
import { PlacePopup } from "@/components/map/PlacePopup";
import { RegionOverlay } from "@/components/map/RegionOverlay";

interface ComingSoonTooltip {
  region: string;
  x: number;
  y: number;
}

export default function InteractiveMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [isMapReady, setMapReady] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMongoConfigured, setMongoConfigured] = useState(true);
  const [comingSoon, setComingSoon] = useState<ComingSoonTooltip | null>(null);
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [isAddMode, setAddMode] = useState(false);
  const [draftPoint, setDraftPoint] = useState<{ longitude: number; latitude: number } | null>(null);
  const [placeRequestMessage, setPlaceRequestMessage] = useState<string | null>(null);

  const hasMapboxToken = isMapboxConfigured();

  const visiblePlaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return places.filter((place) => {
      const categoryMatches = selectedCategory === "all" || place.category === selectedCategory;
      const searchMatches =
        !query ||
        place.name.toLowerCase().includes(query) ||
        place.category.toLowerCase().includes(query) ||
        place.region.toLowerCase().includes(query) ||
        place.address?.toLowerCase().includes(query);

      return categoryMatches && searchMatches;
    });
  }, [places, searchQuery, selectedCategory]);

  const counts = useMemo(() => {
    return places.reduce<Record<string, number>>(
      (acc, place) => {
        acc.all += 1;
        acc[place.category] = (acc[place.category] || 0) + 1;
        return acc;
      },
      { all: 0 },
    );
  }, [places]);

  const schedulePlacesFetch = useCallback((delay = 260) => {
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
    }

    fetchTimerRef.current = setTimeout(() => {
      const activeMap = mapRef.current;

      if (!activeMap) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const bounds = activeMap.getBounds();

      if (!bounds) {
        return;
      }

      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];

      setLoading(true);
      setError(null);

      fetchPlaces({
        bbox,
        region: mapConfig.defaultRegion,
        signal: controller.signal,
      })
        .then((payload) => {
          setPlaces(payload.places);
          setSelectedPlace((current) => {
            if (!current) {
              return current;
            }

            return payload.places.find((place) => place.id === current.id) || current;
          });
          setMongoConfigured(payload.meta.isConfigured);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }

          setError(err instanceof Error ? err.message : "Unable to load places.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, delay);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((payload: { user: PublicUser | null }) => setCurrentUser(payload.user))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (!hasMapboxToken || !mapContainerRef.current || mapRef.current) {
      setLoading(false);
      return;
    }

    const container = mapContainerRef.current;
    container.replaceChildren();
    configureMapbox(mapboxgl);

    const instance = new mapboxgl.Map({
      container,
      style: getPreferredMapStyle(),
      center: mapConfig.defaultCenter,
      zoom: mapConfig.defaultZoom,
      minZoom: mapConfig.minZoom,
      maxZoom: mapConfig.maxZoom,
      maxBounds: mapConfig.tunisiaBounds,
      attributionControl: false,
      cooperativeGestures: true,
    });

    mapRef.current = instance;
    setMap(instance);

    instance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    instance.addControl(new mapboxgl.GeolocateControl({ trackUserLocation: true, showAccuracyCircle: false }), "bottom-right");
    instance.addControl(new mapboxgl.FullscreenControl(), "bottom-right");
    instance.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");
    instance.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    instance.on("load", () => {
      instance.resize();
      if (!instance.getSource("mapbox-dem")) {
        instance.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }

      instance.setTerrain({ source: "mapbox-dem", exaggeration: 1.12 });
      instance.setFog({
        color: "rgb(248, 250, 249)",
        "high-color": "rgb(205, 230, 224)",
        "horizon-blend": 0.08,
      });
      setMapReady(true);
      schedulePlacesFetch(0);
    });

    requestAnimationFrame(() => instance.resize());

    instance.on("moveend", () => schedulePlacesFetch());

    return () => {
      abortRef.current?.abort();

      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
      }

      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }

      draftMarkerRef.current?.remove();
      instance.remove();
      container.replaceChildren();
      mapRef.current = null;
    };
  }, [hasMapboxToken, schedulePlacesFetch]);

  useEffect(() => {
    if (!map || !isMapReady || !isAddMode || !currentUser) {
      return;
    }

    function handleMapClick(event: mapboxgl.MapMouseEvent) {
      if (!map) {
        return;
      }

      const selectableLayers = ["place-point", "place-clusters"].filter((layerId) => map.getLayer(layerId));
      const pointFeatures = selectableLayers.length
        ? map.queryRenderedFeatures(event.point, { layers: selectableLayers })
        : [];

      if (pointFeatures.length) {
        return;
      }

      setSelectedPlace(null);
      setPlaceRequestMessage(null);
      setDraftPoint({
        longitude: Number(event.lngLat.lng.toFixed(6)),
        latitude: Number(event.lngLat.lat.toFixed(6)),
      });
    }

    map.getCanvas().style.cursor = "crosshair";
    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
      map.getCanvas().style.cursor = "";
    };
  }, [currentUser, isAddMode, isMapReady, map]);

  useEffect(() => {
    if (!map || !isMapReady) {
      return;
    }

    draftMarkerRef.current?.remove();

    if (!draftPoint || !isAddMode) {
      draftMarkerRef.current = null;
      return;
    }

    const markerElement = document.createElement("div");
    markerElement.className =
      "grid h-11 w-11 place-items-center rounded-full border-[3px] border-white bg-emerald-600 text-white shadow-[0_16px_34px_rgba(6,95,70,0.32)] ring-8 ring-emerald-500/20";
    markerElement.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';

    const marker = new mapboxgl.Marker({
      element: markerElement,
      draggable: true,
      anchor: "center",
    })
      .setLngLat([draftPoint.longitude, draftPoint.latitude])
      .addTo(map);

    marker.on("dragend", () => {
      const position = marker.getLngLat();
      setDraftPoint({
        longitude: Number(position.lng.toFixed(6)),
        latitude: Number(position.lat.toFixed(6)),
      });
    });

    draftMarkerRef.current = marker;

    return () => {
      marker.remove();
      if (draftMarkerRef.current === marker) {
        draftMarkerRef.current = null;
      }
    };
  }, [draftPoint, isAddMode, isMapReady, map]);

  useEffect(() => {
    if (!placeRequestMessage) {
      return;
    }

    const timer = setTimeout(() => setPlaceRequestMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [placeRequestMessage]);

  function resetToNabeul() {
    mapRef.current?.flyTo({
      center: mapConfig.defaultCenter,
      zoom: mapConfig.defaultZoom,
      duration: 650,
      essential: true,
    });
  }

  function handleSelectPlace(place: Place) {
    setSelectedPlace(place);
    mapRef.current?.easeTo({
      center: place.location.coordinates,
      zoom: Math.max(mapRef.current.getZoom(), 13.5),
      duration: 420,
      offset: window.innerWidth >= 768 ? [-180, 0] : [0, -120],
    });
  }

  function handleReviewAdded(placeId: string, avgRating: number, reviewsCount: number) {
    setPlaces((current) =>
      current.map((place) => (place.id === placeId ? { ...place, avgRating, reviewsCount } : place)),
    );
    setSelectedPlace((current) => (current?.id === placeId ? { ...current, avgRating, reviewsCount } : current));
  }

  function handlePlaceUpdated(updatedPlace: Place) {
    setPlaces((current) => current.map((place) => (place.id === updatedPlace.id ? updatedPlace : place)));
    setSelectedPlace((current) => (current?.id === updatedPlace.id ? updatedPlace : current));
  }

  function handleLockedRegionClick(region: RegionDefinition) {
    const activeMap = mapRef.current;

    if (!activeMap) {
      return;
    }

    const point = activeMap.project(region.center);
    setComingSoon({
      region: region.name,
      x: point.x,
      y: point.y,
    });

    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
    }

    tooltipTimerRef.current = setTimeout(() => setComingSoon(null), 2600);
  }

  function handleSearchSuggestion(suggestion: SearchSuggestion) {
    if (suggestion.kind === "place") {
      setSearchQuery(suggestion.label);
      handleSelectPlace(suggestion.place);
      return;
    }

    if (suggestion.kind === "category") {
      setSelectedCategory(suggestion.category);
      setSearchQuery("");
      return;
    }

    const region = mapConfig.regions.find((item) => item.id === suggestion.regionId);

    if (region?.status === "locked") {
      handleLockedRegionClick(region);
      setSearchQuery("");
      return;
    }

    mapRef.current?.flyTo({
      center: suggestion.center,
      zoom: mapConfig.defaultZoom,
      duration: 650,
      essential: true,
    });
    setSearchQuery("");
  }

  function closeAddMode() {
    setAddMode(false);
    setDraftPoint(null);
    draftMarkerRef.current?.remove();
    draftMarkerRef.current = null;
  }

  function toggleAddMode() {
    if (isAddMode) {
      setDraftPoint(null);
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
    }

    setAddMode(!isAddMode);
    setPlaceRequestMessage(null);
  }

  if (!hasMapboxToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <section className="max-w-md rounded-lg border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-zinc-900">
          <MapPinned className="mb-4 text-emerald-700 dark:text-emerald-300" size={32} />
          <h1 className="text-2xl font-semibold tracking-tight">{brand.appName}</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Add `NEXT_PUBLIC_MAPBOX_TOKEN` to `.env.local` to load the interactive map.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative h-dvh min-h-[680px] overflow-hidden bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="absolute inset-0">
        <div ref={mapContainerRef} data-map-container className="h-full w-full" />
      </div>

      <PlaceMarker
        map={map}
        isReady={isMapReady}
        places={visiblePlaces}
        selectedPlaceId={selectedPlace?.id}
        onSelectPlace={handleSelectPlace}
      />
      <RegionOverlay map={map} isReady={isMapReady} onLockedRegionClick={handleLockedRegionClick} />

      {/* ── Left controls: search + category filter ── */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex w-[min(calc(100vw-84px),480px)] flex-col gap-2.5 md:left-4 md:top-4 md:w-[230px] lg:w-[260px]">
        <MapSearch
          value={searchQuery}
          region={mapConfig.defaultRegion}
          onChange={setSearchQuery}
          onResetView={resetToNabeul}
          onSelectSuggestion={handleSearchSuggestion}
        />
        <CategoryFilter selected={selectedCategory} counts={counts} onSelect={setSelectedCategory} />
      </div>

      {/* ── Right controls: auth + add place ── */}
      <div className="pointer-events-none absolute right-3 top-3 z-40 flex flex-col items-end gap-2 md:right-4 md:top-4">
        <AuthConnect />
        {currentUser ? (
          <button
            type="button"
            onClick={toggleAddMode}
            className={[
              "pointer-events-auto inline-flex h-11 items-center gap-2 rounded-2xl border px-3.5 text-sm font-semibold shadow-[0_8px_28px_rgba(15,23,42,0.16)] backdrop-blur-[32px] saturate-150 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_44px_rgba(15,23,42,0.22)]",
              isAddMode
                ? "border-emerald-500/25 bg-emerald-600/90 text-white"
                : "border-black/[0.07] bg-white/82 text-zinc-900 hover:bg-white/95 dark:border-white/[0.07] dark:bg-zinc-950/82 dark:text-zinc-100 dark:hover:bg-zinc-900/92",
            ].join(" ")}
          >
            {isAddMode ? <X size={16} /> : <Plus size={16} />}
            <span className="hidden sm:inline">{isAddMode ? "Cancel" : "Add place"}</span>
          </button>
        ) : (
          <Link
            href="/signin"
            className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-2xl border border-black/[0.07] bg-white/82 px-3.5 text-sm font-semibold text-zinc-900 shadow-[0_8px_28px_rgba(15,23,42,0.16)] backdrop-blur-[32px] saturate-150 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_16px_44px_rgba(15,23,42,0.22)] dark:border-white/[0.07] dark:bg-zinc-950/82 dark:text-zinc-100 dark:hover:bg-zinc-900/92"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add place</span>
          </Link>
        )}
      </div>

      {isAddMode && currentUser && !draftPoint ? (
        <div className="pointer-events-none absolute left-1/2 top-[88px] z-30 w-[min(90vw,360px)] -translate-x-1/2 rounded-2xl border border-black/[0.07] bg-white/88 px-4 py-3.5 text-sm font-semibold text-zinc-800 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-[32px] saturate-150 dark:border-white/[0.07] dark:bg-zinc-950/88 dark:text-zinc-100 md:top-5">
          <div className="flex items-center justify-center gap-2">
            <MousePointer2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            Click the map to choose the place location.
          </div>
        </div>
      ) : null}

      {isAddMode && draftPoint && currentUser ? (
        <aside className="animate-fade-slide-up absolute inset-x-3 bottom-3 z-40 max-h-[78vh] overflow-y-auto rounded-2xl border border-black/[0.07] bg-white/90 p-4 shadow-[0_24px_72px_rgba(15,23,42,0.24),0_4px_16px_rgba(15,23,42,0.1)] backdrop-blur-[32px] saturate-150 dark:border-white/[0.07] dark:bg-zinc-950/90 md:inset-x-auto md:bottom-4 md:left-4 md:top-[156px] md:w-[420px]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                New place request
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Add a place on the map</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Drag the green pin to adjust position.</p>
            </div>
            <button
              type="button"
              onClick={closeAddMode}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/8 dark:hover:text-zinc-200"
              aria-label="Close add place panel"
            >
              <X size={16} />
            </button>
          </div>
          <AddPlaceForm
            coordinates={draftPoint}
            onSubmitted={() => {
              setPlaceRequestMessage("Place submitted for admin approval.");
              closeAddMode();
            }}
          />
        </aside>
      ) : null}

      {placeRequestMessage ? (
        <div className="animate-fade-slide-up absolute left-1/2 top-5 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-emerald-500/15 bg-white/92 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-[0_12px_40px_rgba(16,185,129,0.15),0_4px_14px_rgba(15,23,42,0.1)] backdrop-blur-[32px] saturate-150 dark:border-emerald-400/15 dark:bg-zinc-950/92 dark:text-emerald-300">
          <CheckCircle2 size={17} />
          {placeRequestMessage}
        </div>
      ) : null}

      {comingSoon ? (
        <div
          className="animate-fade-in absolute z-30 max-w-[220px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-2xl border border-white/10 bg-zinc-950/92 px-3.5 py-2.5 text-sm font-medium text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          style={{ left: comingSoon.x, top: comingSoon.y }}
        >
          <div className="flex items-center gap-2">
            <Lock size={14} className="shrink-0 text-red-400" />
            <span>{comingSoon.region} coming soon.</span>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border border-black/[0.07] bg-white/92 px-4 py-3 text-sm font-semibold text-zinc-700 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-[32px] saturate-150 dark:border-white/[0.07] dark:bg-zinc-950/90 dark:text-zinc-200">
          <Loader2 size={17} className="animate-spin text-emerald-600 dark:text-emerald-400" />
          Loading places
        </div>
      ) : null}

      {!isLoading && !error && !isMongoConfigured ? (
        <div className="absolute left-1/2 top-1/2 z-20 w-[min(92vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/[0.07] bg-white/95 p-5 text-sm text-zinc-700 shadow-[0_24px_64px_rgba(15,23,42,0.2)] backdrop-blur-[32px] saturate-150 dark:border-white/[0.07] dark:bg-zinc-950/92 dark:text-zinc-300">
          <Database className="mb-3 text-emerald-600 dark:text-emerald-400" size={22} />
          <p className="font-semibold text-zinc-950 dark:text-zinc-50">MongoDB is not connected</p>
          <p className="mt-1.5 leading-6">Add `MONGODB_URI` to `.env.local` and the map will load places from your database.</p>
        </div>
      ) : null}

      {!isLoading && !error && isMongoConfigured && visiblePlaces.length === 0 ? (
        <div className="absolute left-1/2 top-1/2 z-20 w-[min(92vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/[0.07] bg-white/95 p-5 text-sm text-zinc-700 shadow-[0_24px_64px_rgba(15,23,42,0.2)] backdrop-blur-[32px] saturate-150 dark:border-white/[0.07] dark:bg-zinc-950/92 dark:text-zinc-300">
          <MapPinned className="mb-3 text-emerald-600 dark:text-emerald-400" size={22} />
          <p className="font-semibold text-zinc-950 dark:text-zinc-50">No places found</p>
          <p className="mt-1.5 leading-6">Try another category, clear search, or pan the map.</p>
        </div>
      ) : null}

      {error ? (
        <div className="absolute left-1/2 top-1/2 z-20 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-orange-200/60 bg-orange-50/95 p-5 text-sm text-orange-900 shadow-[0_24px_64px_rgba(234,88,12,0.15)] backdrop-blur-[32px] dark:border-orange-400/15 dark:bg-orange-400/8 dark:text-orange-100">
          <AlertCircle className="mb-3 text-orange-600 dark:text-orange-400" size={22} />
          <p className="font-semibold">Could not load places</p>
          <p className="mt-1.5 leading-6">{error}</p>
        </div>
      ) : null}

      <PlacePopup
        place={selectedPlace}
        currentUser={currentUser}
        onClose={() => setSelectedPlace(null)}
        onReviewAdded={handleReviewAdded}
        onPlaceUpdated={handlePlaceUpdated}
      />
    </main>
  );
}
