import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appOrigin, supabaseConfig } from '../src/lib/config.ts';

test('configuration validates production origin and fails closed without auth setup', () => {
  const snapshot = { ...process.env };
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(supabaseConfig(), null);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fixture-publishable';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:4519/supabase/';
    assert.equal(supabaseConfig().url, 'http://127.0.0.1:4519/supabase');
    for (const invalid of ['https://user:pass@example.com', 'https://example.com?secret=value', 'javascript:alert(1)']) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = invalid;
      assert.equal(supabaseConfig(), null);
    }
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ORIGIN;
    assert.throws(appOrigin, /required/);
    for (const invalid of ['http://example.com', 'https://example.com/path', 'https://user:pass@example.com', 'https://example.com?next=bad', 'javascript:alert(1)']) {
      process.env.APP_ORIGIN = invalid;
      assert.throws(appOrigin);
    }
    process.env.APP_ORIGIN = 'https://example.com';
    assert.equal(appOrigin(), 'https://example.com');
    process.env.NODE_ENV = 'development';
    delete process.env.APP_ORIGIN;
    assert.equal(appOrigin(), 'http://localhost:3000');
  } finally {
    for (const key of ['NODE_ENV', 'APP_ORIGIN', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  }
});
