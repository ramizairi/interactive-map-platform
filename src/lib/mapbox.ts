import { mapConfig } from "@/config/map";

type MapboxApi = typeof import("mapbox-gl").default;

export function getPublicMapboxToken() {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
}

export function isMapboxConfigured() {
  return getPublicMapboxToken().trim().length > 0;
}

export function getPreferredMapStyle() {
  if (typeof window === "undefined") {
    return mapConfig.mapStyleUrl;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? mapConfig.mapStyleDarkUrl
    : mapConfig.mapStyleUrl;
}

export function configureMapbox(mapboxgl: MapboxApi) {
  mapboxgl.accessToken = getPublicMapboxToken();
}
