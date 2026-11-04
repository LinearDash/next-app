import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// Fictional test-only encryption keys; never real secrets.
const k1 = randomBytes(32).toString('base64'), k2 = randomBytes(32).toString('base64');
process.env.GEMINI_KEY_ENCRYPTION_KEYS = `v1:${k1}`;
const { seal, unseal, vaultConfigured } = await import('../src/lib/vault.ts');
const { availability, checkFinder, finderInputSchema, finderOutputSchema, keyInputSchema, savedFinderSchema, verdictInputSchema, verdictOutputSchema } = await import('../src/lib/ai-contract.ts');

const alice = '00000000-0000-0000-0000-000000000001', bob = '00000000-0000-0000-0000-000000000002';
const secret = 'AIzaFICTIONAL-test-key-0000000000000000';
const flip = value => { const bytes = Buffer.from(value, 'base64'); bytes[0] ^= 1; return bytes.toString('base64'); };

test('vault: round trip, fresh nonces, no plaintext in sealed fields', () => {
  const a = seal(alice, secret), b = seal(alice, secret);
  assert.equal(unseal(alice, a), secret);
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.equal(Buffer.from(a.nonce, 'base64').length, 12);
  assert.equal(a.nonce.length, 16); assert.equal(a.auth_tag.length, 24); // matches migration checks
  assert.ok(!JSON.stringify(a).includes(secret) && !JSON.stringify(a).includes(secret.slice(4, 20)));
});

test('vault: tampering, wrong owner and unknown key version all fail closed', () => {
  const sealed = seal(alice, secret);
  for (const field of ['ciphertext', 'nonce', 'auth_tag']) assert.throws(() => unseal(alice, { ...sealed, [field]: flip(sealed[field]) }), /Key vault/);
  assert.throws(() => unseal(bob, sealed), /Key vault/); // row copied to another account
  assert.throws(() => unseal(alice, { ...sealed, key_version: 'v9' }), /Key vault/);
  assert.throws(() => unseal(alice, { ...sealed, auth_tag: Buffer.alloc(8).toString('base64') }), /Key vault/); // truncated tag
});

test('vault: rotation decrypts old versions; bad configuration is reported, not used', () => {
  const old = seal(alice, secret);
  process.env.GEMINI_KEY_ENCRYPTION_KEYS = `v2:${k2},v1:${k1}`;
  assert.equal(unseal(alice, old), secret);
  assert.equal(seal(alice, secret).key_version, 'v2');
  for (const value of ['', 'v1:short', `bad:${k1}`, k1]) {
    process.env.GEMINI_KEY_ENCRYPTION_KEYS = value;
    assert.equal(vaultConfigured(), false);
    assert.throws(() => seal(alice, secret), /Key vault/);
  }
  process.env.GEMINI_KEY_ENCRYPTION_KEYS = `v1:${k1}`;
});

test('eligibility fails closed: kill switch, vault, region allowlist; "*" only outside production', () => {
  const env = { enabled: '1', countries: 'US,CA', production: true, vault: true };
  assert.equal(availability(env, 'US'), 'ok');
  assert.equal(availability(env, 'GB'), 'unavailable_region');
  assert.equal(availability(env, null), 'unavailable_region');
  assert.equal(availability(env, 'us'), 'unavailable_region');
  assert.equal(availability({ ...env, enabled: undefined }, 'US'), 'disabled');
  assert.equal(availability({ ...env, vault: false }, 'US'), 'disabled');
  assert.equal(availability({ ...env, countries: '' }, 'US'), 'unavailable_region');
  assert.equal(availability({ ...env, countries: '*' }, 'US'), 'unavailable_region');
  assert.equal(availability({ ...env, countries: '*', production: false }, null), 'ok');
});

test('inputs are bounded; outputs are strict; finder picks must be offered, distinct candidates', () => {
  const key = '10000000-0000-4000-8000-000000000001';
  assert.equal(keyInputSchema.safeParse('short').success, false);
  assert.equal(keyInputSchema.safeParse('AIza key with spaces 00000000000').success, false);
  assert.equal(verdictInputSchema.parse({ mediaType: 'tv', id: '42', requestKey: key }).subset, false);
  assert.equal(verdictInputSchema.safeParse({ mediaType: 'tv', id: '42', requestKey: 'not-a-uuid' }).success, false);
  const finder = finderInputSchema.parse({ genres: ['35'], exclude: ['7'], requestKey: key, maxRuntime: '120', mood: '  cosy  ' });
  assert.deepEqual([finder.mediaType, finder.genres, finder.maxRuntime, finder.mood, finder.exclude], ['movie', [35], 120, 'cosy', [7]]);
  for (const bad of [{ genres: ['1', '2', '3', '4'] }, { genres: ['35', '35'] }, { maxRuntime: '20' }, { maxRuntime: '999' }, { language: 'english' },
    { mood: 'x'.repeat(201) }, { exclude: Array(31).fill('1') }, { mediaType: 'person' }])
    assert.equal(finderInputSchema.safeParse({ genres: [], exclude: [], requestKey: key, ...bad }).success, false, JSON.stringify(bad));

  const verdict = { verdict: 'maybe', summary: 'Tense and slow.', reasons_for: ['Atmosphere'], reasons_against: [] };
  assert.ok(verdictOutputSchema.safeParse(verdict).success);
  for (const bad of [{ ...verdict, verdict: 'yes' }, { ...verdict, summary: '' }, { ...verdict, reasons_for: ['a', 'b', 'c', 'd'] }, { ...verdict, match: '92%' }])
    assert.equal(verdictOutputSchema.safeParse(bad).success, false);
  const offered = new Set([1, 2, 3]);
  const picks = ids => finderOutputSchema.parse({ picks: ids.map(id => ({ id, reason: 'Fits the mood.' })) });
  assert.ok(checkFinder(picks([1, 3]), offered));
  assert.equal(checkFinder(picks([1, 99]), offered), null); // invented ID
  assert.equal(checkFinder(picks([2, 2]), offered), null);
  assert.equal(finderOutputSchema.safeParse({ picks: [1, 2, 3, 4].map(id => ({ id, reason: 'x' })) }).success, false);
  assert.equal(savedFinderSchema.safeParse({ picks: [], request: {}, ratedCount: 0, subset: false }).success, false);
});
