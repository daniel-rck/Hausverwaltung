import { ExtractionError, errorKindFromStatus } from "./errors";
import { EXTRACTION_PROMPT } from "./prompt";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiSettings = {
  apiKey: string;
  model: string;
};

// Mirrors ScannedAbrechnung (scanMapping.ts); everything nullable —
// validation happens app-side in parseScanResponse.
const POSITION_SCHEMA = {
  type: "OBJECT",
  properties: {
    label: { type: "STRING", nullable: true },
    amount: { type: "NUMBER", nullable: true },
    consumption: { type: "NUMBER", nullable: true },
    unit: { type: "STRING", nullable: true },
  },
} as const;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    provider: { type: "STRING", nullable: true },
    billingFrom: { type: "STRING", nullable: true, description: "ISO YYYY-MM-DD" },
    billingTo: { type: "STRING", nullable: true, description: "ISO YYYY-MM-DD" },
    year: { type: "NUMBER", nullable: true },
    units: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          unitLabel: { type: "STRING", nullable: true },
          tenantName: { type: "STRING", nullable: true },
          positions: { type: "ARRAY", items: POSITION_SCHEMA },
          total: { type: "NUMBER", nullable: true },
        },
      },
    },
    totals: { type: "ARRAY", items: POSITION_SCHEMA },
  },
} as const;

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Send one or more photos of a Messdienst statement to Gemini and return
 * the structured extraction as untyped JSON — callers validate via
 * `parseScanResponse`. Throws `ExtractionError`; never leaks the API key.
 */
export async function extractAbrechnung(
  images: Blob[],
  settings: GeminiSettings,
): Promise<unknown> {
  const imageParts = await Promise.all(
    images.map(async (image) => ({
      inlineData: {
        mimeType: image.type || "image/jpeg",
        data: await blobToBase64(image),
      },
    })),
  );

  const body = {
    contents: [{ parts: [...imageParts, { text: EXTRACTION_PROMPT }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE}/models/${encodeURIComponent(settings.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Auth via header only — `?key=` query params leak into caches/logs.
          "x-goog-api-key": settings.apiKey,
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new ExtractionError("network");
  }

  if (!response.ok) {
    throw new ExtractionError(errorKindFromStatus(response.status));
  }

  try {
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("empty");
    // With responseSchema there is no markdown fence to strip.
    return JSON.parse(text) as unknown;
  } catch {
    throw new ExtractionError("unparsable");
  }
}

/** Minimal authenticated request to validate an API key ("Key testen"). */
export async function testApiKey(settings: GeminiSettings): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/models/${encodeURIComponent(settings.model)}`, {
      headers: { "x-goog-api-key": settings.apiKey },
    });
    return response.ok;
  } catch {
    return false;
  }
}
