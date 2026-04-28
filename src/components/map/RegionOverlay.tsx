"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import type { FeatureCollection, Polygon } from "geojson";
import type mapboxgl from "mapbox-gl";
import { brand } from "@/config/brand";
import { mapConfig, lockedRegions, type RegionDefinition } from "@/config/map";

const SOURCE_ID = "regions-source";
const LOCKED_FILL_LAYER_ID = "locked-region-fill";
const ACTIVE_LINE_LAYER_ID = "active-region-line";
const LOCKED_LINE_LAYER_ID = "locked-region-line";

interface RegionOverlayProps {
  map: mapboxgl.Map | null;
  isReady: boolean;
  onLockedRegionClick: (region: RegionDefinition) => void;
}

interface RegionLabel {
  region: RegionDefinition;
  x: number;
  y: number;
  visible: boolean;
}

export function RegionOverlay({ map, isReady, onLockedRegionClick }: RegionOverlayProps) {
  const [labels, setLabels] = useState<RegionLabel[]>([]);
  const regionData = useMemo(() => toRegionFeatures(), []);

  useEffect(() => {
    if (!map || !isReady) {
      return;
    }

    ensureRegionLayers(map, regionData);

    return () => {
      removeLayerIfExists(map, ACTIVE_LINE_LAYER_ID);
      removeLayerIfExists(map, LOCKED_LINE_LAYER_ID);
      removeLayerIfExists(map, LOCKED_FILL_LAYER_ID);
      removeSourceIfExists(map, SOURCE_ID);
    };
  }, [isReady, map, regionData]);

  useEffect(() => {
    if (!map || !isReady) {
      return;
    }

    const activeMap = map;

    function updateLabels() {
      const zoom = activeMap.getZoom();
      const shouldShow = zoom <= mapConfig.regionOverlayMaxZoom;
      const nextLabels = lockedRegions.map((region) => {
        const point = activeMap.project(region.center);
        return {
          region,
          x: point.x,
          y: point.y,
          visible: shouldShow,
        };
      });

      setLabels(nextLabels);
    }

    updateLabels();
    activeMap.on("move", updateLabels);
    activeMap.on("zoom", updateLabels);
    activeMap.on("resize", updateLabels);

    return () => {
      activeMap.off("move", updateLabels);
      activeMap.off("zoom", updateLabels);
      activeMap.off("resize", updateLabels);
    };
  }, [isReady, map]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {labels.map(({ region, x, y, visible }) => (
        <button
          key={region.id}
          type="button"
          onClick={() => onLockedRegionClick(region)}
          className={[
            "pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-red-500/45 bg-red-50/86 px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm backdrop-blur-xl transition hover:bg-red-100/92 dark:border-red-400/30 dark:bg-red-950/68 dark:text-red-100",
            visible ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{ left: x, top: y }}
          aria-label={`${region.name} locked`}
          tabIndex={visible ? 0 : -1}
        >
          <Lock size={13} />
          <span>{region.name}</span>
          <span className="text-red-500 dark:text-red-300">Locked</span>
        </button>
      ))}
    </div>
  );
}

function ensureRegionLayers(map: mapboxgl.Map, data: FeatureCollection<Polygon>) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data,
    });
  }

  if (!map.getLayer(LOCKED_FILL_LAYER_ID)) {
    map.addLayer({
      id: LOCKED_FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      maxzoom: mapConfig.regionOverlayMaxZoom,
      filter: ["==", ["get", "status"], "locked"],
      paint: {
        "fill-color": brand.lockedRegionStyles.fill,
        "fill-outline-color": brand.lockedRegionStyles.line,
      },
    });
  }

  if (!map.getLayer(LOCKED_LINE_LAYER_ID)) {
    map.addLayer({
      id: LOCKED_LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      maxzoom: mapConfig.regionOverlayMaxZoom,
      filter: ["==", ["get", "status"], "locked"],
      paint: {
        "line-color": brand.lockedRegionStyles.line,
        "line-width": 1.3,
        "line-dasharray": [2, 2],
      },
    });
  }

  if (!map.getLayer(ACTIVE_LINE_LAYER_ID)) {
    map.addLayer({
      id: ACTIVE_LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      maxzoom: mapConfig.regionOverlayMaxZoom,
      filter: ["==", ["get", "status"], "enabled"],
      paint: {
        "line-color": brand.colors.accent,
        "line-width": 2.2,
      },
    });
  }
}

function toRegionFeatures(): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: mapConfig.regions.map((region) => {
      const [[west, south], [east, north]] = region.bounds;

      return {
        type: "Feature",
        properties: {
          id: region.id,
          name: region.name,
          status: region.status,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      };
    }),
  };
}

function removeLayerIfExists(map: mapboxgl.Map, layerId: string) {
  safelyRunMapOperation(map, () => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  });
}

function removeSourceIfExists(map: mapboxgl.Map, sourceId: string) {
  safelyRunMapOperation(map, () => {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  });
}

function isMapUsable(map: mapboxgl.Map) {
  try {
    return Boolean(map.getStyle());
  } catch {
    return false;
  }
}

function safelyRunMapOperation(map: mapboxgl.Map, operation: () => void) {
  if (!isMapUsable(map)) {
    return;
  }

  try {
    operation();
  } catch {
    // Mapbox may already be tearing down its style graph during React cleanup.
  }
}
