import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3417" },
  webServer: [{
    command: "postman simulation run postman/simulations/catalog.sim.yaml --port 4519 --no-history --output ndjson",
    url: "http://127.0.0.1:4519/tmdb/__requests",
    reuseExistingServer: false,
  }, {
    command: "npm run start -- --hostname 127.0.0.1 --port 3417",
    url: "http://127.0.0.1:3417",
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4519/supabase", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "supabase-simulation-publishable", APP_ORIGIN: "https://iiwi.example", CATALOG_TEST_BUILD: "1", TMDB_ACCESS_TOKEN: "catalog-simulation-token", TMDB_SIMULATION_URL: "http://127.0.0.1:4519/tmdb/3" },
  }],
});
