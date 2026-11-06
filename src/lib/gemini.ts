import "server-only";
import { z } from "zod";
import { GEMINI_MODEL, SYSTEM_PROMPT } from "./ai-contract";

export class GeminiError extends Error {
  constructor(
    public code: "provider_auth" | "provider_limited" | "upstream_unavailable" | "invalid_response",
  ) {
    super("Gemini request could not be completed");
  }
}

function endpoint(apiKey: string) {
  const simulation = process.env.GEMINI_SIMULATION_URL;
  if (simulation) {
    const url = new URL(simulation);
    // Tests may target a loopback stand-in, but must never forward a real user key there.
    if (
      apiKey !== "gemini-simulation-key" ||
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.protocol !== "http:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new GeminiError("upstream_unavailable");
    return { base: simulation.replace(/\/$/, ""), timeout: 3000 };
  }
  return { base: "https://generativelanguage.googleapis.com/v1beta", timeout: 25000 };
}

const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z
              .array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }))
              .max(20),
          })
          .optional(),
      }),
    )
    .max(8)
    .optional(),
});

// One stateless generateContent call: no retries, no tools, no stored interactions. The caller re-validates meaning.
export async function generate(apiKey: string, input: unknown, schema: object): Promise<unknown> {
  const { base, timeout } = endpoint(apiKey);
  let response: Response;
  try {
    response = await fetch(`${base}/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: 4096,
          candidateCount: 1,
        },
      }),
    });
  } catch {
    throw new GeminiError("upstream_unavailable");
  }
  let raw: string;
  try {
    raw = await readCapped(response, 262144);
  } catch {
    throw new GeminiError(response.ok ? "invalid_response" : "upstream_unavailable");
  }
  // Never relay provider bodies: they can echo request details. Only status codes and the invalid-key reason are used.
  if (!response.ok) {
    diagnose(`http ${response.status}`, providerReasons(raw));
    if (response.status === 400 && raw.includes("API_KEY_INVALID"))
      throw new GeminiError("provider_auth");
    if ([401, 403].includes(response.status)) throw new GeminiError("provider_auth");
    if (response.status === 429) throw new GeminiError("provider_limited");
    throw new GeminiError(response.status === 400 ? "invalid_response" : "upstream_unavailable");
  }
  try {
    const candidate = responseSchema.parse(JSON.parse(raw)).candidates?.[0];
    if (candidate?.finishReason !== "STOP") {
      diagnose(`finishReason ${candidate?.finishReason ?? "missing"}`);
      throw new Error("Incomplete");
    }
    const text = (candidate.content?.parts || [])
      .filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("");
    try {
      return JSON.parse(text);
    } catch {
      diagnose("output is not JSON");
      throw new Error("Not JSON");
    }
  } catch {
    throw new GeminiError("invalid_response");
  }
}

// Server-log diagnostics: categories and Google's machine-readable reason/field names only.
// Never the key, the prompt, the model's text or a provider message.
export function diagnose(what: string, details: string[] = []) {
  console.warn(`[gemini] ${what}${details.length ? ` (${details.join(", ")})` : ""}`);
}

function providerReasons(raw: string) {
  try {
    const parsed = z
      .object({
        error: z.object({
          status: z.string().max(60).optional(),
          details: z
            .array(
              z.object({
                reason: z.string().max(80).optional(),
                fieldViolations: z
                  .array(z.object({ field: z.string().max(120).optional() }))
                  .max(10)
                  .optional(),
              }),
            )
            .max(10)
            .optional(),
        }),
      })
      .parse(JSON.parse(raw)).error;
    const safe = (value: string) => value.replace(/[^A-Za-z0-9_.[\]]/g, "");
    return [
      parsed.status,
      ...(parsed.details || []).flatMap((detail) => [
        detail.reason,
        ...(detail.fieldViolations || []).map((violation) => violation.field),
      ]),
    ]
      .filter((value): value is string => Boolean(value))
      .map(safe);
  } catch {
    return [];
  }
}

async function readCapped(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("Too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).toString("utf8");
}
