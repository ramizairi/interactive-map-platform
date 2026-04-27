export type UserRole = "user" | "admin";

export interface PublicUser {
  id: string;
  name: string;
  username: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  role: UserRole;
  stats: {
    visitors: number;
    placesAdded: number;
    reviews: number;
    reactions: number;
  };
  createdAt: string;
}

export interface PendingPlaceRequest {
  id: string;
  name: string;
  category: string;
  description?: string;
  address?: string;
  region: string;
  coordinates: [number, number];
  images: string[];
  status: "pending" | "approved" | "rejected";
  submittedBy: string;
  submittedByUsername: string;
  aiVerification?: PlaceVerification;
  createdAt: string;
}

export interface PlaceVerification {
  provider: "gemini";
  model: string;
  recommendation: "approve" | "reject" | "needs_review";
  confidence: number;
  summary: string;
  issues: string[];
  checkedAt: string;
}
