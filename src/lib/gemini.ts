import "server-only";
import { z } from "zod";
import { GEMINI_MODEL, SYSTEM_PROMPT } from "./ai-contract";

export class GeminiError extends Error {
  constructor(public code: "provider_auth" | "provider_limited" | "upstream_unavailable" | "invalid_response") {
    super("Gemini request could not be completed");
  }
}

function endpoint(apiKey: string) {
  const simulation = process.env.GEMINI_SIMULATION_URL;
  if (simulation) {
    const url = new URL(simulation);
    // Tests may target a loopback stand-in, but must never forward a real user key there.
    if (apiKey !== "gemini-simulation-key" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.protocol !== "http:" ||
        url.username || url.password || url.search || url.hash) throw new GeminiError("upstream_unavailable");
    return { base: simulation.replace(/\/$/, ""), timeout: 3000 };
  }
  return { base: "https://generativelanguage.googleapis.com/v1beta", timeout: 25000 };
}

const responseSchema = z.object({
  candidates: z.array(z.object({
    finishReason: z.string().optional(),
    content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })).max(20) }).optional(),
  })).max(8).optional(),
});

// One stateless generateContent call: no retries, no tools, no stored interactions. The caller re-validates meaning.
export async function generate(apiKey: string, input: unknown, schema: object): Promise<unknown> {
  const { base, timeout } = endpoint(apiKey);
  let response: Response;
  try {
    response = await fetch(`${base}/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(timeout),
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 4096, candidateCount: 1 },
      }),
    });
  } catch { throw new GeminiError("upstream_unavailable"); }
  let raw: string;
  try { raw = await readCapped(response, 262144); } catch { throw new GeminiError(response.ok ? "invalid_response" : "upstream_unavailable"); }
  // Never relay provider bodies: they can echo request details. Only status codes and the invalid-key reason are used.
  if (!response.ok) {
    if (response.status === 400 && raw.includes("API_KEY_INVALID")) throw new GeminiError("provider_auth");
    if ([401, 403].includes(response.status)) throw new GeminiError("provider_auth");
    if (response.status === 429) throw new GeminiError("provider_limited");
    throw new GeminiError(response.status === 400 ? "invalid_response" : "upstream_unavailable");
  }
  try {
    const candidate = responseSchema.parse(JSON.parse(raw)).candidates?.[0];
    if (candidate?.finishReason !== "STOP") throw new Error("Incomplete");
    const text = (candidate.content?.parts || []).filter(part => !part.thought).map(part => part.text || "").join("");
    return JSON.parse(text);
  } catch { throw new GeminiError("invalid_response"); }
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
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString("utf8");
}
