import "server-only";

import type { PendingPlaceRequest, PlaceVerification } from "@/types/auth";

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export async function verifyPlaceWithGemini(place: PendingPlaceRequest): Promise<PlaceVerification> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const checkedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      provider: "gemini",
      model,
      recommendation: "needs_review",
      confidence: 0,
      summary: "Gemini verification is not configured.",
      issues: ["Add GEMINI_API_KEY or GOOGLE_AI_API_KEY to enable AI verification."],
      checkedAt,
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildVerificationPrompt(place),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              recommendation: {
                type: "string",
                enum: ["approve", "reject", "needs_review"],
                description: "Whether this place should be approved, rejected, or reviewed by an admin.",
              },
              confidence: {
                type: "number",
                description: "Confidence in the recommendation from 0 to 1.",
              },
              summary: {
                type: "string",
                description: "Short admin-facing explanation.",
              },
              issues: {
                type: "array",
                items: { type: "string" },
                description: "Specific data quality or safety issues.",
              },
            },
            required: ["recommendation", "confidence", "summary", "issues"],
          },
        },
      }),
    },
  );
  const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Gemini verification failed.");
  }

  const text = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;

  if (!text) {
    throw new Error("Gemini returned an empty verification response.");
  }

  const parsed = JSON.parse(text) as Partial<PlaceVerification>;

  return {
    provider: "gemini",
    model,
    recommendation: normalizeRecommendation(parsed.recommendation),
    confidence: clampConfidence(parsed.confidence),
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "No summary returned.",
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.filter((issue): issue is string => typeof issue === "string").slice(0, 8)
      : [],
    checkedAt,
  };
}

function buildVerificationPrompt(place: PendingPlaceRequest) {
  return `You verify user-submitted places for a public Cap Bon / Nabeul food and tourism map.

Use only the submitted information and basic plausibility checks. Do not invent external facts.

Approve only if:
- the name looks like a real place, producer, artisan, market, restaurant, cafe, hotel, attraction, beach, or shop
- category matches the description/name
- coordinates are plausible for Cap Bon / Nabeul, Tunisia
- it is not spam, abuse, a personal private address, or clearly incomplete

Return needs_review when the submission may be valid but lacks enough detail.
Return reject for spam, unsafe content, coordinates far outside the region, or incoherent data.

Submission:
${JSON.stringify(
  {
    name: place.name,
    category: place.category,
    description: place.description,
    address: place.address,
    region: place.region,
    coordinates: place.coordinates,
    imagesCount: place.images.length,
    submittedByUsername: place.submittedByUsername,
  },
  null,
  2,
)}`;
}

function normalizeRecommendation(value: unknown): PlaceVerification["recommendation"] {
  return value === "approve" || value === "reject" || value === "needs_review" ? value : "needs_review";
}

function clampConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(Math.max(number, 0), 1);
}
