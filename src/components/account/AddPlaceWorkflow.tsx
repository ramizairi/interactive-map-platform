"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { useEffect, useRef, useState } from "react";
import { MapPin, MousePointer2 } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { mapConfig } from "@/config/map";
import { configureMapbox, getPreferredMapStyle } from "@/lib/mapbox";
import { AddPlaceForm } from "@/components/account/AddPlaceForm";

type PickedPoint = {
  longitude: number;
  latitude: number;
};

export function AddPlaceWorkflow() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [point, setPoint] = useState<PickedPoint | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    container.replaceChildren();
    configureMapbox(mapboxgl);

    const map = new mapboxgl.Map({
      container,
      style: getPreferredMapStyle(),
      center: mapConfig.defaultCenter,
      zoom: 12.4,
      maxBounds: mapConfig.nabeulBounds,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");

    map.on("load", () => map.resize());
    map.on("click", (event) => {
      const nextPoint = {
        longitude: roundCoordinate(event.lngLat.lng),
        latitude: roundCoordinate(event.lngLat.lat),
      };

      setPoint(nextPoint);

      if (!markerRef.current) {
        markerRef.current = new mapboxgl.Marker({
          color: "#0f8f72",
          draggable: true,
        })
          .setLngLat([nextPoint.longitude, nextPoint.latitude])
          .addTo(map);

        markerRef.current.on("dragend", () => {
          const lngLat = markerRef.current?.getLngLat();

          if (lngLat) {
            setPoint({
              longitude: roundCoordinate(lngLat.lng),
              latitude: roundCoordinate(lngLat.lat),
            });
          }
        });
      } else {
        markerRef.current.setLngLat([nextPoint.longitude, nextPoint.latitude]);
      }
    });

    requestAnimationFrame(() => map.resize());

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      container.replaceChildren();
    };
  }, []);

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white/80 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
              <MousePointer2 size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Choose the exact point</p>
              <p className="text-xs text-zinc-500">Click on the map, then drag the marker if needed.</p>
            </div>
          </div>
          {point ? (
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200 sm:inline">
              Selected
            </span>
          ) : null}
        </div>
        <div ref={containerRef} className="h-[420px] w-full lg:h-[650px]" />
      </div>

      <div>
        {point ? (
          <AddPlaceForm coordinates={point} />
        ) : (
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white/70 p-6 text-center shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <div className="max-w-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                <MapPin size={22} />
              </div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Pick a location first</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                The submission form appears after you click the place location on the map.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}
