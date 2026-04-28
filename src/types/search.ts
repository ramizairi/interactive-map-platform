import type { Coordinates, Place, PlaceCategory } from "@/types/places";

export type SearchSuggestionKind = "place" | "category" | "region";

export interface BaseSearchSuggestion {
  id: string;
  kind: SearchSuggestionKind;
  label: string;
  subtitle?: string;
}

export interface PlaceSearchSuggestion extends BaseSearchSuggestion {
  kind: "place";
  place: Place;
}

export interface CategorySearchSuggestion extends BaseSearchSuggestion {
  kind: "category";
  category: PlaceCategory | "all";
  color: string;
}

export interface RegionSearchSuggestion extends BaseSearchSuggestion {
  kind: "region";
  regionId: string;
  center: Coordinates;
  status: "enabled" | "locked";
}

export type SearchSuggestion = PlaceSearchSuggestion | CategorySearchSuggestion | RegionSearchSuggestion;

export interface AutocompleteResponse {
  suggestions: SearchSuggestion[];
  meta: {
    isConfigured: boolean;
    query: string;
    count: number;
  };
}
