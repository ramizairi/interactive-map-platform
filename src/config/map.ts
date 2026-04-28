import { brand } from "@/config/brand";
import type { Coordinates, PlaceCategory } from "@/types/places";

export interface CategoryDefinition {
  id: PlaceCategory | "all";
  label: string;
  icon:
    | "Sparkles"
    | "Hotel"
    | "Utensils"
    | "Store"
    | "Sprout"
    | "Hammer";
  color: string;
  mapIcon: string;
}

export interface RegionDefinition {
  id: string;
  name: string;
  center: Coordinates;
  status: "enabled" | "locked";
  bounds: [Coordinates, Coordinates];
}

export const mapConfig = {
  defaultRegion: process.env.NEXT_PUBLIC_DEFAULT_REGION || "Nabeul",
  defaultCenter: [10.9, 36.75] as Coordinates,
  defaultZoom: 9.8,
  minZoom: 5.4,
  maxZoom: 18,
  tunisiaBounds: [
    [7.25, 30.0],
    [12.1, 37.75],
  ] as [Coordinates, Coordinates],
  nabeulBounds: [
    [10.32, 36.24],
    [11.16, 37.15],
  ] as [Coordinates, Coordinates],
  regionOverlayMaxZoom: 8.35,
  clusterMaxZoom: 13,
  clusterRadius: 46,
  mapStyleUrl: brand.mapTheme.light,
  mapStyleDarkUrl: brand.mapTheme.dark,
  categories: [
    { id: "all", label: "All", icon: "Sparkles", color: brand.colors.accent, mapIcon: "marker-15" },
    { id: "restaurant", label: "Restaurants", icon: "Utensils", color: brand.markerStyles.restaurant, mapIcon: "restaurant-15" },
    { id: "market", label: "Markets", icon: "Store", color: brand.markerStyles.market, mapIcon: "shop-15" },
    { id: "producer", label: "Producers", icon: "Sprout", color: brand.markerStyles.producer, mapIcon: "marker-15" },
    { id: "artisan", label: "Artisans", icon: "Hammer", color: brand.markerStyles.artisan, mapIcon: "shop-15" },
    { id: "hotel", label: "Hotels", icon: "Hotel", color: brand.markerStyles.hotel, mapIcon: "lodging-15" },
  ] satisfies CategoryDefinition[],
  regions: [
    {
      id: "nabeul",
      name: "Nabeul",
      center: [10.9, 36.75],
      status: "enabled",
      bounds: [
        [10.32, 36.24],
        [11.16, 37.15],
      ],
    },
    {
      id: "tunis",
      name: "Tunis",
      center: [10.18, 36.81],
      status: "locked",
      bounds: [
        [9.85, 36.6],
        [10.42, 37.05],
      ],
    },
    {
      id: "sousse",
      name: "Sousse",
      center: [10.64, 35.83],
      status: "locked",
      bounds: [
        [10.32, 35.62],
        [10.9, 36.04],
      ],
    },
    {
      id: "sfax",
      name: "Sfax",
      center: [10.76, 34.74],
      status: "locked",
      bounds: [
        [10.38, 34.48],
        [11.1, 35.0],
      ],
    },
    {
      id: "bizerte",
      name: "Bizerte",
      center: [9.87, 37.27],
      status: "locked",
      bounds: [
        [9.45, 37.02],
        [10.25, 37.55],
      ],
    },
    {
      id: "djerba",
      name: "Djerba",
      center: [10.86, 33.8],
      status: "locked",
      bounds: [
        [10.62, 33.62],
        [11.1, 33.95],
      ],
    },
  ] satisfies RegionDefinition[],
} as const;

export const enabledRegions = mapConfig.regions.filter((region) => region.status === "enabled");
export const lockedRegions = mapConfig.regions.filter((region) => region.status === "locked");
export const supportedCategoryIds = new Set(mapConfig.categories.map((category) => category.id));
