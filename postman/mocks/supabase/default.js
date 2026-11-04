// Local Auth/PostgREST contract subset, fictional identities only. Not hosted Supabase RLS evidence.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("node:http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { randomUUID } = require("node:crypto");
const identities = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];
const profiles = () => identities.map(owner => ({ owner, onboarding_completed: false, genre_preferences: [], consent_version: null, consent_at: null }));
const initial = () => ({ mode: "normal", entries: [], dismissals: [], profiles: profiles(), credentials: [], results: [], aiRequests: [], requests: [] });

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

// Serialize requests: the real database's per-user advisory lock makes AI limits atomic; mirror that here.
let queue = Promise.resolve();
http.createServer((req, res) => { queue = queue.then(() => handle(req, res)).catch(() => { try { res.writeHead(500); res.end(); } catch { /* already sent */ } }); }).listen(process.env.PORT || 4520);

async function handle(req, res) {
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
  if (url.pathname === "/__seed" && req.method === "POST") {
    // Test-only fixtures: fake request history (quota) or many rated titles (input budget).
    const owner = url.searchParams.get("owner"), count = Number(url.searchParams.get("count") || 0), kind = url.searchParams.get("kind");
    for (let index = 0; index < count; index++) {
      if (kind === "requests") state.aiRequests.push({ id: randomUUID(), owner, action: "verdict", idempotency_key: randomUUID(), status: "done", created_at: new Date().toISOString() });
      else state.entries.push({ id: randomUUID(), owner, tmdb_id: 1000 + index, media_type: "movie", status: "watched", reaction: 4, tags: [], created_at: new Date().toISOString(), updated_at: new Date(Date.now() - index * 1000).toISOString() });
    }
    await pm.state.set("supabase.data", state);
    return send(200, { ok: true });
  }
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
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    if (!owner || state.mode === "expired") return send(401, { message: "Session expired" });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const fn = url.pathname.slice("/rest/v1/rpc/".length);
    const error = (code, message) => send(400, { code, message, details: null, hint: null });
    if (fn === "set_ai_consent") {
      if (body.p_version !== null && !/^[a-z0-9.-]{1,80}$/.test(body.p_version || "")) return error("22023", "invalid consent version");
      const profile = state.profiles.find(row => row.owner === owner);
      Object.assign(profile, { consent_version: body.p_version, consent_at: body.p_version ? new Date().toISOString() : null });
      await pm.state.set("supabase.data", state);
      return send(200, null);
    }
    if (fn === "begin_ai_request") {
      if (!["verdict", "finder"].includes(body.p_action) || !body.p_key) return error("22023", "invalid request");
      const mine = state.aiRequests.filter(row => row.owner === owner);
      if (mine.some(row => row.idempotency_key === body.p_key)) return error("IW001", "duplicate submission");
      if (mine.some(row => row.status === "pending" && Date.now() - Date.parse(row.created_at) < 120000)) return error("IW002", "request in progress");
      if (mine.filter(row => Date.now() - Date.parse(row.created_at) < 86400000).length >= 20) return error("IW003", "daily limit reached");
      const row = { id: randomUUID(), owner, action: body.p_action, idempotency_key: body.p_key, status: "pending", created_at: new Date().toISOString() };
      state.aiRequests.push(row);
      await pm.state.set("supabase.data", state);
      return send(200, row.id);
    }
    if (fn === "finish_ai_request") {
      const row = state.aiRequests.find(item => item.id === body.p_id && item.owner === owner && item.status === "pending");
      if (row) Object.assign(row, { status: body.p_ok ? "done" : "failed", finished_at: new Date().toISOString() });
      await pm.state.set("supabase.data", state);
      return send(200, null);
    }
    return send(404, { message: "Function not modeled" });
  }
  const table = { library_entries: "entries", dismissals: "dismissals", profiles: "profiles", provider_credentials: "credentials", ai_results: "results" }[url.pathname.replace("/rest/v1/", "")];
  if (!table) return send(501, { error: "Endpoint not modeled" });
  if (!owner || state.mode === "expired") return send(401, { message: "Session expired" });
  if (state.mode === "db-outage" || (state.mode === "write-failure" && !["GET", "HEAD"].includes(req.method))) return send(503, { message: "Database temporarily unavailable" });
  const matches = row => row.owner === owner && filtered(row, url.searchParams);
  let rows = state[table].filter(matches);
  if (req.method === "POST") {
    const body = req.body;
    if (!body || Array.isArray(body) || body.owner !== owner) return send(403, { message: "Ownership check failed" });
    // Results always insert; credentials are keyed by owner; library rows by owner + media type + ID.
    let existing = table === "results" ? null : state[table].find(row => row.owner === owner && (table === "credentials" || (row.media_type === body.media_type && row.tmdb_id === body.tmdb_id)));
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
}
