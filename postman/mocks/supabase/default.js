// Local Auth/PostgREST contract subset, fictional identities only. Not hosted Supabase RLS evidence.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("node:http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { randomUUID } = require("node:crypto");
const identities = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];
const profiles = () => identities.map(owner => ({ owner, onboarding_completed: false, genre_preferences: [] }));
const initial = () => ({ mode: "normal", entries: [], dismissals: [], profiles: profiles(), requests: [] });

function authenticated(req) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const parts = token.split(".");
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return parts[2] === "fixture-signature" && identities.includes(claims.sub) && claims.exp > Date.now() / 1000 ? claims.sub : null;
  } catch { return null; }
}
function filtered(row, params) {
  for (const [key, value] of params) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;
    if (value === "is.null" && row[key] !== null) return false;
    if (value === "not.is.null" && row[key] === null) return false;
    if (value.startsWith("eq.") && String(row[key]) !== value.slice(3)) return false;
    if (value.startsWith("in.(") && !value.slice(4, -1).split(",").includes(String(row[key]))) return false;
  }
  return true;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body, extra = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(body));
  };
  let state = await pm.state.get("supabase.data") || initial();
  if (url.pathname === "/__control" && req.method === "POST") {
    state = initial();
    await pm.state.set("supabase.data", state);
    return send(200, { ok: true });
  }
  if (url.pathname === "/__mode" && req.method === "POST") {
    state.mode = url.searchParams.get("mode") || "normal";
    await pm.state.set("supabase.data", state);
    return send(200, { ok: true });
  }
  if (url.pathname === "/__state") return send(200, state);
  const owner = authenticated(req);
  state.requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), owner });
  await pm.state.set("supabase.data", state);
  if (url.pathname === "/auth/v1/user") {
    if (state.mode === "auth-outage") return send(503, { code: "unexpected_failure", msg: "Unavailable" });
    if (!owner || state.mode === "expired") return send(401, { code: "session_not_found", msg: "Session expired" });
    return send(200, { id: owner, aud: "authenticated", role: "authenticated", email: owner === identities[0] ? "alice@example.test" : "bob@example.test",
      app_metadata: { provider: "google", providers: ["google"] }, user_metadata: {}, identities: [], created_at: "2026-11-05T00:00:00Z" });
  }
  if (url.pathname === "/auth/v1/logout") return send(204, null);
  const table = { library_entries: "entries", dismissals: "dismissals", profiles: "profiles" }[url.pathname.replace("/rest/v1/", "")];
  if (!table) return send(501, { error: "Endpoint not modeled" });
  if (!owner || state.mode === "expired") return send(401, { message: "Session expired" });
  if (state.mode === "db-outage" || (state.mode === "write-failure" && !["GET", "HEAD"].includes(req.method))) return send(503, { message: "Database temporarily unavailable" });
  const matches = row => row.owner === owner && filtered(row, url.searchParams);
  let rows = state[table].filter(matches);
  if (req.method === "POST") {
    const body = req.body;
    if (!body || Array.isArray(body) || body.owner !== owner) return send(403, { message: "Ownership check failed" });
    let existing = state[table].find(row => row.owner === owner && row.media_type === body.media_type && row.tmdb_id === body.tmdb_id);
    if (!existing) {
      existing = { id: randomUUID(), created_at: new Date().toISOString(), ...body };
      state[table].push(existing);
    }
    Object.assign(existing, body, { updated_at: new Date().toISOString() });
    rows = [existing];
  } else if (req.method === "PATCH") {
    const body = req.body;
    if (!body || Object.keys(body).some(key => !["onboarding_completed", "genre_preferences"].includes(key))) return send(403, { message: "Column not writable" });
    rows.forEach(row => Object.assign(row, body));
  } else if (req.method === "DELETE") {
    state[table] = state[table].filter(row => !matches(row));
  } else if (!["GET", "HEAD"].includes(req.method)) return send(501, { error: "Method not modeled" });
  await pm.state.set("supabase.data", state);
  const total = rows.length;
  if (["GET", "HEAD"].includes(req.method)) {
    rows.sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")) || a.tmdb_id - b.tmdb_id);
    const offset = Number(url.searchParams.get("offset") || 0);
    const limit = Number(url.searchParams.get("limit") || total);
    rows = rows.slice(offset, offset + limit);
  }
  const accept = req.headers.accept || "";
  if (accept.includes("application/vnd.pgrst.object+json")) {
    if (rows.length !== 1) return send(406, { code: "PGRST116", details: `${rows.length} rows`, message: "Cannot coerce to a single JSON object" });
    return send(200, rows[0]);
  }
  return send(200, rows, { "Content-Range": `${rows.length ? "0-" + (rows.length - 1) : "*"}/${total}` });
}).listen(process.env.PORT || 4520);
