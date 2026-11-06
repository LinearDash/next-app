import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL engine, simulated Supabase auth schema/claims. Not live identity evidence.
test("migration enforces ownership, constraints, restricted consent and cascades", async () => {
  const db = new PGlite();
  const alice = "00000000-0000-0000-0000-000000000001";
  const bob = "00000000-0000-0000-0000-000000000002";
  try {
    await db.exec(`create schema auth;
      create role anon nologin; create role authenticated nologin;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/202611050001_foundation.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.query("insert into auth.users values ($1), ($2)", [alice, bob]);
    async function asUser(id) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      await db.exec("set role authenticated");
    }
    const count = async (table) =>
      Number((await db.query(`select count(*) from public.${table}`)).rows[0].count);
    await asUser(alice);
    assert.equal(await count("profiles"), 1);
    await db.query("update profiles set genre_preferences = '{18,35}' where owner = $1", [alice]);
    await assert.rejects(
      db.exec("update profiles set consent_version = 'v1', consent_at = now()"),
      /permission denied/,
    );
    await assert.rejects(db.exec("update profiles set genre_preferences = '{-1}'"), /valid_genres/);
    await db.query(
      "insert into library_entries(owner, tmdb_id, media_type, status, reaction) values ($1, 42, 'movie', 'watching', 5), ($1, 42, 'tv', 'watched', null)",
      [alice],
    );
    await db.query("insert into dismissals(owner, media_type, tmdb_id) values ($1, 'movie', 70)", [
      alice,
    ]);
    await assert.rejects(
      db.query(
        "insert into library_entries(owner,tmdb_id,media_type,status) values ($1, 99, 'movie', 'watched')",
        [bob],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "insert into library_entries(owner,tmdb_id,media_type,status,reaction) values ($1, 99, 'movie', 'watched',6)",
        [alice],
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.exec("update library_entries set tags = '{spoiler}'"),
      /controlled_tags/,
    );
    await assert.rejects(
      db.exec("update library_entries set tags = array[null]::text[]"),
      /controlled_tags/,
    );
    await assert.rejects(
      db.query(
        "insert into library_entries(owner,tmdb_id,media_type,status) values ($1,42,'movie','watched')",
        [alice],
      ),
      /unique constraint/,
    );
    await db.query(
      "update library_entries set status='watched', reaction=null, tags='{interesting}' where owner=$1 and media_type='movie'",
      [alice],
    );
    assert.deepEqual(
      (await db.query("select status,reaction,tags from library_entries where media_type='movie'"))
        .rows[0],
      { status: "watched", reaction: null, tags: ["interesting"] },
    );
    await db.query(
      "insert into library_entries(owner,tmdb_id,media_type,status,reaction,tags) values($1,42,'movie','dropped',2,'{boring}') on conflict(owner,media_type,tmdb_id) do update set status=excluded.status,reaction=excluded.reaction,tags=excluded.tags",
      [alice],
    );
    assert.equal(await count("library_entries"), 2);
    await asUser(bob);
    assert.equal(
      (
        await db.query(
          "update profiles set onboarding_completed=true where owner=$1 returning owner",
          [alice],
        )
      ).rows.length,
      0,
    );
    assert.equal(await count("library_entries"), 0);
    assert.equal(await count("dismissals"), 0);
    assert.equal(await count("profiles"), 1);
    assert.equal(
      (await db.exec("update library_entries set reaction = 1 returning id"))[0].rows.length,
      0,
    );
    assert.equal((await db.exec("delete from dismissals returning tmdb_id"))[0].rows.length, 0);
    await db.query(
      "insert into library_entries(owner,tmdb_id,media_type,status) values ($1,42,'movie','want_to_watch')",
      [bob],
    );
    await assert.rejects(
      db.query("update library_entries set owner = $1", [alice]),
      /row-level security/,
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(db.exec("select * from profiles"), /permission denied/);
    await assert.rejects(db.exec("select * from library_entries"), /permission denied/);
    await assert.rejects(db.exec("select * from dismissals"), /permission denied/);
    await db.exec("reset role");
    await db.query("delete from auth.users where id = $1", [alice]);
    assert.equal(await count("profiles"), 1);
    assert.equal(await count("library_entries"), 1);
    assert.equal(await count("dismissals"), 0);
  } finally {
    await db.close();
  }
});
