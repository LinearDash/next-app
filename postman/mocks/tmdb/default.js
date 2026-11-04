// Fictional fixtures following the published TMDB v3 shapes; never live catalog evidence.
// Postman mock handlers load as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("node:http");
const headers = { "Content-Type": "application/json" };
function title(type, id = 42) {
  const common = { id, adult: false, overview: "A keeper searches for a missing ship. <script>window.catalogInjected=true</script>",
    poster_path: id === 42 ? "/broken-poster.jpg" : null, vote_average: 7.8, vote_count: 321, original_language: "en", genres: [{ id: 18, name: "Drama" }] };
  return type === "movie" ? { ...common, title: id === 42 ? "The Last Lighthouse" : "Another Movie", release_date: "2024-03-15", runtime: 112 }
    : { ...common, name: id === 42 ? "Lighthouse Diaries" : "Another Series", first_air_date: "2023-06-20", number_of_seasons: 3 };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body) => { res.writeHead(status, headers); res.end(JSON.stringify(body)); };
  if (url.pathname === "/__control" && req.method === "POST") {
    await pm.state.set("tmdb.mode", url.searchParams.get("mode") || "normal");
    await pm.state.set("tmdb.requests", []);
    return send(200, { ok: true });
  }
  if (url.pathname === "/__requests") return send(200, await pm.state.get("tmdb.requests") || []);
  const validBearer = req.headers.authorization === "Bearer catalog-simulation-token";
  const requests = await pm.state.get("tmdb.requests") || [];
  requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), validBearer });
  await pm.state.set("tmdb.requests", requests);
  if (!validBearer) return send(401, { status_code: 7, status_message: "Invalid API key", success: false });
  if (req.method !== "GET") return send(501, { error: "Not modeled" });
  const match = /^\/3\/(?:(search)\/)?(movie|tv)\/(popular|[1-9]\d*)$/.exec(url.pathname)
    || /^\/3\/(search)\/(movie|tv)$/.exec(url.pathname);
  if (!match) return send(501, { error: "Endpoint not modeled" });
  const [, isSearch, type, action] = match;
  const query = url.searchParams.get("query") || "";
  const mode = await pm.state.get("tmdb.mode") || "normal";
  if (mode === "partial" && type === "movie") return send(503, { status_message: "Temporarily unavailable" });
  if (query === "unavailable") { res.writeHead(503, { "Content-Type": "text/html" }); return res.end("<h1>Upstream unavailable</h1>"); }
  if (query === "unauthorized") return send(401, { status_code: 7, status_message: "Do not expose provider details", success: false });
  if (query === "limited") return send(429, { status_code: 25, status_message: "Rate limited" });
  if (query === "malformed") { res.writeHead(200, headers); return res.end("{invalid JSON"); }
  if (query === "invalidshape") return send(200, { results: [{ id: -1 }] });
  if (query === "oversized") { res.writeHead(200, headers); return res.end(JSON.stringify({ padding: "x".repeat(1100000) })); }
  if (query === "slow") await new Promise(resolve => setTimeout(resolve, 6500));
  if (url.searchParams.get("language") !== "en-US") return send(400, { status_message: "Missing language" });
  if (isSearch && (!query || url.searchParams.get("include_adult") !== "false")) return send(400, { status_message: "Invalid search parameters" });
  if (action && action !== "popular") {
    if (!["42", "43", "999"].includes(action)) return send(404, { status_code: 34, status_message: "Resource not found" });
    return send(200, title(type, action === "999" ? 42 : Number(action)));
  }
  const page = Number(url.searchParams.get("page") || "1");
  if (query === "empty") return send(200, { page, results: [], total_pages: 0, total_results: 0 });
  const results = page === 1 ? [title(type), title(type, 43)] : [title(type, 43)];
  return send(200, { page, results, total_pages: 2, total_results: 3 });
}).listen(process.env.PORT || 4519);
