import { spawnSync } from "node:child_process";

// Compile without real auth/catalog credentials; tests must never reach live services.
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    CATALOG_TEST_BUILD: "1",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4519/supabase",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "supabase-simulation-publishable",
    TMDB_ACCESS_TOKEN: "",
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
