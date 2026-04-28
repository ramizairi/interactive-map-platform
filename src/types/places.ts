export type PlaceCategory =
  | "hotel"
  | "restaurant"
  | "cafe"
  | "market"
  | "producer"
  | "artisan"
  | "attraction"
  | "shopping"
  | "beach"
  | "other";

export type Coordinates = [longitude: number, latitude: number];

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  description?: string;
  images: string[];
  address?: string;
  region: string;
  city?: string;
  zone?: string;
  sourceId?: string;
  originalCategory?: string;
  subCategory?: string;
  specialties?: string;
  hours?: string;
  contact?: string;
  budget?: string;
  practicalNotes?: string;
  googleMapsUrl?: string;
  location: {
    type: "Point";
    coordinates: Coordinates;
  };
  avgRating: number;
  reviewsCount: number;
  isActive: boolean;
}

export interface Review {
  id: string;
  placeId: string;
  userId?: string;
  authorName?: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlacesResponse {
  places: Place[];
  meta: {
    isConfigured: boolean;
    count: number;
    region: string;
  };
}

export interface ReviewsResponse {
  reviews: Review[];
  meta: {
    isConfigured: boolean;
    count: number;
  };
}

export interface CreateReviewInput {
  rating: number;
  comment: string;
  authorName?: string;
  userId?: string;
}
