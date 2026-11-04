// Fictional Gemini generateContent stand-in (documented REST shapes only); never live provider evidence.
// Accepts only the dummy simulation key. Failure modes are switched with POST /__control?mode=...
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("node:http");
const headers = { "Content-Type": "application/json" };
let mode = "normal";
let requests = []; // in-process (not pm.state) so concurrent requests are never lost

function reply(input) {
  if (input.task === "verdict") return { verdict: "worth_it", summary: "Moody and patient <img src=x onerror=\"window.injected=1\">, close to the slow-burn titles you loved.",
    reasons_for: ["Atmosphere like the titles you loved"], reasons_against: ["Slower pace than you sometimes enjoy"], ...(mode === "schema-break" ? { match: "92%" } : {}) };
  const ids = (input.candidates || []).map(candidate => candidate.id);
  if (mode === "invented") return { picks: [{ id: 999999, reason: "Invented title" }] };
  if (mode === "empty") return { picks: [] };
  return { picks: ids.slice(0, 2).map(id => ({ id, reason: `Matches your mood (candidate ${id}).` })) };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body) => { res.writeHead(status, headers); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
  if (url.pathname === "/__control" && req.method === "POST") { mode = url.searchParams.get("mode") || "normal"; requests = []; return send(200, { ok: true }); }
  if (url.pathname === "/__requests") return send(200, requests);
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const keyValid = req.headers["x-goog-api-key"] === "gemini-simulation-key";
  requests.push({ path: url.pathname, keyValid, body });
  if (req.method !== "POST" || url.pathname !== "/v1beta/models/gemini-3.5-flash-lite:generateContent") return send(404, { error: { code: 404, status: "NOT_FOUND" } });
  if (!keyValid || mode === "invalid-key") return send(400, { error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } });
  if (mode === "limited") return send(429, { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } });
  if (mode === "unavailable") return send(503, { error: { code: 503, status: "UNAVAILABLE", message: "Overloaded" } });
  if (mode === "slow") await new Promise(resolve => setTimeout(resolve, 1500));
  if (mode === "timeout") await new Promise(resolve => setTimeout(resolve, 4000));
  let input = {};
  try { input = JSON.parse(body.contents[0].parts[0].text); } catch { return send(400, { error: { code: 400, status: "INVALID_ARGUMENT" } }); }
  if (!body.systemInstruction || body.generationConfig?.responseMimeType !== "application/json" || !body.generationConfig?.responseSchema) return send(400, { error: { code: 400, status: "INVALID_ARGUMENT" } });
  const text = mode === "malformed" ? "{not json" : JSON.stringify(reply(input));
  return send(200, { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: mode === "max-tokens" ? "MAX_TOKENS" : "STOP" }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 } });
}).listen(process.env.PORT || 4521);
