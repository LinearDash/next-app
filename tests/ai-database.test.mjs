import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL engine, simulated Supabase auth schema/claims. Not hosted-RLS evidence.
const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const key1 = '10000000-0000-4000-8000-000000000001';
const cred = "(owner, ciphertext, nonce, auth_tag, key_version, key_hint) values ($1, 'Y2lwaGVy', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 'v1', 'abcd')";
const result = "(owner, action, media_type, tmdb_id, result, model, prompt_version, schema_version, taste_fingerprint) values ($1, $2, 'movie', $3, '{\"verdict\":\"skip\"}', 'gemini-test', 'p1', 's1', repeat('a', 64))";

test('AI vault, results, limits and consent enforce ownership and atomic limits', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth;
      create role anon nologin; create role authenticated nologin;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    for (const file of ['202611050001_foundation.sql', '202611050002_ai.sql'])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1), ($2)', [alice, bob]);
    const asUser = async id => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]); await db.exec('set role authenticated'); };
    const begin = (key, action = 'verdict') => db.query('select public.begin_ai_request($1, $2) as id', [action, key]);
    const rows = async sql => (await db.query(sql)).rows;

    await asUser(alice);
    await db.query(`insert into provider_credentials ${cred}`, [alice]);
    await assert.rejects(db.query(`insert into provider_credentials ${cred}`, [bob]), /row-level security/);
    await assert.rejects(db.query("update provider_credentials set nonce = 'short'"), /check constraint/);
    await assert.rejects(db.query("update provider_credentials set provider = 'openai'"), /check constraint/);
    await db.query(`insert into ai_results ${result}`, [alice, 'verdict', 42]);
    await db.query(`insert into ai_results ${result}`, [alice, 'finder', null]);
    await assert.rejects(db.query(`insert into ai_results ${result}`, [alice, 'verdict', null]), /verdict_subject/);
    await assert.rejects(db.exec("update ai_results set result = '{}'"), /permission denied/);
    await assert.rejects(db.exec('select * from ai_requests'), /permission denied/);

    // Consent only through the dedicated function; direct column writes stay forbidden.
    await assert.rejects(db.exec("update profiles set consent_version = 'x', consent_at = now()"), /permission denied/);
    await db.query("select public.set_ai_consent('ai-2026-11-05')");
    assert.equal((await rows('select consent_version from profiles'))[0].consent_version, 'ai-2026-11-05');
    await assert.rejects(db.query("select public.set_ai_consent('<script>')"), /invalid consent version/);

    // Limits: one in flight, duplicate keys rejected, then a daily cap.
    const first = (await begin(key1)).rows[0].id;
    await assert.rejects(begin('10000000-0000-4000-8000-000000000002'), error => error.code === 'IW002');
    await db.query('select public.finish_ai_request($1, true)', [first]);
    await assert.rejects(begin(key1), error => error.code === 'IW001');
    await assert.rejects(db.query("select public.begin_ai_request('delete', $1)", [key1]), /invalid request/);

    await asUser(bob);
    assert.equal((await rows('select * from provider_credentials')).length, 0);
    assert.equal((await rows('select * from ai_results')).length, 0);
    assert.equal((await rows("delete from ai_results returning id")).length, 0);
    assert.equal((await rows("update provider_credentials set key_hint = 'zzzz' returning owner")).length, 0);
    // Alice's pending/finished requests and consent do not affect Bob.
    const bobRequest = (await begin('20000000-0000-4000-8000-000000000001', 'finder')).rows[0].id;
    await db.query('select public.finish_ai_request($1, false)', [first]); // someone else's id: no effect
    await db.query('select public.finish_ai_request($1, false)', [bobRequest]);
    assert.equal((await rows('select consent_version from profiles'))[0].consent_version, null);

    await db.exec('reset role');
    assert.equal((await rows(`select status from ai_requests where id = '${first}'`))[0].status, 'done');
    await db.query("insert into ai_requests (owner, action, idempotency_key) select $1, 'verdict', gen_random_uuid() from generate_series(1, 19)", [alice]);
    await db.exec("update ai_requests set status = 'done'");
    await asUser(alice);
    await assert.rejects(begin('10000000-0000-4000-8000-000000000003'), error => error.code === 'IW003');
    await db.query('select public.set_ai_consent(null)');
    assert.deepEqual((await rows('select consent_version, consent_at from profiles'))[0], { consent_version: null, consent_at: null });

    await db.exec('reset role; set role anon');
    for (const table of ['provider_credentials', 'ai_results', 'ai_requests']) await assert.rejects(db.exec(`select * from ${table}`), /permission denied/);
    await assert.rejects(begin('30000000-0000-4000-8000-000000000001'), /permission denied/);
    await assert.rejects(db.query("select public.set_ai_consent('x')"), /permission denied/);

    await db.exec('reset role');
    await db.query('delete from auth.users where id = $1', [alice]);
    for (const table of ['provider_credentials', 'ai_results']) assert.equal((await rows(`select * from ${table}`)).length, 0);
    assert.equal((await rows(`select * from ai_requests where owner = '${alice}'`)).length, 0);
  } finally { await db.close(); }
});
