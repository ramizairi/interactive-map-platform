"use client";

import { useEffect, useMemo } from "react";
import type { FeatureCollection, Point } from "geojson";
import type { ExpressionSpecification } from "mapbox-gl";
import type mapboxgl from "mapbox-gl";
import { brand } from "@/config/brand";
import { mapConfig } from "@/config/map";
import type { Place } from "@/types/places";

const SOURCE_ID = "places-source";
const CLUSTER_LAYER_ID = "place-clusters";
const CLUSTER_COUNT_LAYER_ID = "place-cluster-count";
const POINT_HALO_LAYER_ID = "place-point-halo";
const POINT_LAYER_ID = "place-point";
const POINT_ICON_LAYER_ID = "place-point-icon";
const LABEL_LAYER_ID = "place-label";

interface PlaceMarkerProps {
  map: mapboxgl.Map | null;
  isReady: boolean;
  places: Place[];
  selectedPlaceId?: string;
  onSelectPlace: (place: Place) => void;
}

export function PlaceMarker({ map, isReady, places, selectedPlaceId, onSelectPlace }: PlaceMarkerProps) {
  const placeById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const data = useMemo(() => toFeatureCollection(places, selectedPlaceId), [places, selectedPlaceId]);

  useEffect(() => {
    if (!map || !isReady) {
      return;
    }

    ensurePlaceLayers(map);

    return () => {
      removeLayerIfExists(map, LABEL_LAYER_ID);
      removeLayerIfExists(map, POINT_ICON_LAYER_ID);
      removeLayerIfExists(map, POINT_LAYER_ID);
      removeLayerIfExists(map, POINT_HALO_LAYER_ID);
      removeLayerIfExists(map, CLUSTER_COUNT_LAYER_ID);
      removeLayerIfExists(map, CLUSTER_LAYER_ID);
      removeSourceIfExists(map, SOURCE_ID);
    };
  }, [map, isReady]);

  useEffect(() => {
    if (!map || !isReady) {
      return;
    }

    if (!isMapUsable(map)) {
      return;
    }

    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(data);
  }, [data, isReady, map]);

  useEffect(() => {
    if (!map || !isReady) {
      return;
    }

    const activeMap = map;

    function handlePointClick(event: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
      const feature = event.features?.[0];
      const id = typeof feature?.properties?.id === "string" ? feature.properties.id : undefined;
      const place = id ? placeById.get(id) : undefined;

      if (place) {
        onSelectPlace(place);
      }
    }

    function handleClusterClick(event: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
      const feature = event.features?.[0];

      if (!feature || feature.geometry.type !== "Point") {
        return;
      }

      activeMap.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom: Math.min(activeMap.getZoom() + 2.2, mapConfig.maxZoom),
        duration: 450,
      });
    }

    function setPointer() {
      activeMap.getCanvas().style.cursor = "pointer";
    }

    function clearPointer() {
      activeMap.getCanvas().style.cursor = "";
    }

    activeMap.on("click", POINT_LAYER_ID, handlePointClick);
    activeMap.on("click", CLUSTER_LAYER_ID, handleClusterClick);
    activeMap.on("mouseenter", POINT_LAYER_ID, setPointer);
    activeMap.on("mouseenter", CLUSTER_LAYER_ID, setPointer);
    activeMap.on("mouseleave", POINT_LAYER_ID, clearPointer);
    activeMap.on("mouseleave", CLUSTER_LAYER_ID, clearPointer);

    return () => {
      safelyRunMapOperation(activeMap, () => {
        activeMap.off("click", POINT_LAYER_ID, handlePointClick);
        activeMap.off("click", CLUSTER_LAYER_ID, handleClusterClick);
        activeMap.off("mouseenter", POINT_LAYER_ID, setPointer);
        activeMap.off("mouseenter", CLUSTER_LAYER_ID, setPointer);
        activeMap.off("mouseleave", POINT_LAYER_ID, clearPointer);
        activeMap.off("mouseleave", CLUSTER_LAYER_ID, clearPointer);
      });
    };
  }, [isReady, map, onSelectPlace, placeById]);

  return null;
}

function ensurePlaceLayers(map: mapboxgl.Map) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: toFeatureCollection([], undefined),
      cluster: true,
      clusterMaxZoom: mapConfig.clusterMaxZoom,
      clusterRadius: mapConfig.clusterRadius,
    });
  }

  if (!map.getLayer(CLUSTER_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": brand.colors.foreground,
        "circle-opacity": 0.88,
        "circle-radius": ["step", ["get", "point_count"], 20, 12, 25, 40, 31],
        "circle-stroke-width": 4,
        "circle-stroke-color": "rgba(255,255,255,0.85)",
      },
    });
  }

  if (!map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
      paint: {
        "text-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer(POINT_HALO_LAYER_ID)) {
    map.addLayer({
      id: POINT_HALO_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "rgba(255,255,255,0.95)",
        "circle-radius": ["case", ["get", "selected"], 16, 12],
        "circle-blur": 0.1,
        "circle-opacity": 0.95,
      },
    });
  }

  if (!map.getLayer(POINT_LAYER_ID)) {
    map.addLayer({
      id: POINT_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": categoryColorExpression(),
        "circle-radius": ["case", ["get", "selected"], 10, 7],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": ["case", ["get", "selected"], 3, 2],
        "circle-opacity": 0.96,
      },
    });
  }

  if (!map.getLayer(POINT_ICON_LAYER_ID)) {
    map.addLayer({
      id: POINT_ICON_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": categoryIconExpression(),
        "icon-size": ["case", ["get", "selected"], 1.05, 0.86],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-color": "#ffffff",
        "icon-halo-color": "rgba(0,0,0,0.08)",
        "icon-halo-width": 0.6,
      },
    });
  }

  if (!map.getLayer(LABEL_LAYER_ID)) {
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      minzoom: 13,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
        "text-offset": [0, 1.25],
        "text-size": 11,
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "rgba(255,255,255,0.92)",
        "text-halo-width": 1.2,
      },
    });
  }
}

function toFeatureCollection(places: Place[], selectedPlaceId?: string): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: places.map((place) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: place.location.coordinates,
      },
      properties: {
        id: place.id,
        name: place.name,
        category: place.category,
        selected: place.id === selectedPlaceId,
      },
    })),
  };
}

function categoryColorExpression() {
  const expression: unknown[] = ["match", ["get", "category"]];

  for (const category of mapConfig.categories) {
    if (category.id !== "all") {
      expression.push(category.id, category.color);
    }
  }

  expression.push(brand.markerStyles.other);
  return expression as ExpressionSpecification;
}

function categoryIconExpression() {
  const expression: unknown[] = ["match", ["get", "category"]];

  for (const category of mapConfig.categories) {
    if (category.id !== "all") {
      expression.push(category.id, category.mapIcon);
    }
  }

  expression.push("marker-15");
  return expression as ExpressionSpecification;
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
