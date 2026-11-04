import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  // Simulates the platform-set country header that gates AI eligibility (trusted only via GEMINI_TRUST_COUNTRY_HEADER in tests).
  use: { baseURL: "http://127.0.0.1:3417", extraHTTPHeaders: { "x-vercel-ip-country": "US" } },
  webServer: [{
    command: "postman simulation run postman/simulations/catalog.sim.yaml --port 4519 --no-history --output ndjson",
    url: "http://127.0.0.1:4519/tmdb/__requests",
    reuseExistingServer: false,
  }, {
    command: "npm run start -- --hostname 127.0.0.1 --port 3417",
    url: "http://127.0.0.1:3417",
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4519/supabase", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "supabase-simulation-publishable", APP_ORIGIN: "https://iiwi.example", CATALOG_TEST_BUILD: "1", TMDB_ACCESS_TOKEN: "catalog-simulation-token", TMDB_SIMULATION_URL: "http://127.0.0.1:4519/tmdb/3",
      // Fictional, test-only AI configuration; the simulation override accepts only a loopback URL and the dummy key.
      GEMINI_ENABLED: "1", GEMINI_ALLOWED_COUNTRIES: "US", GEMINI_TRUST_COUNTRY_HEADER: "1",
      GEMINI_KEY_ENCRYPTION_KEYS: "v1:BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=", GEMINI_SIMULATION_URL: "http://127.0.0.1:4519/gemini/v1beta" },
  }],
});
