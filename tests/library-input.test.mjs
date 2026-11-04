import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changesSchema, entryInputSchema, libraryFiltersSchema, preferencesSchema, scalar } from '../src/lib/library-input.ts';

test('library input preserves optional/early ratings and controlled tags', () => {
  assert.deepEqual(changesSchema.parse({ status: 'watching', reaction: '5', tags: ['confusing', 'rewatchable'] }), { status: 'watching', reaction: 5, tags: ['confusing', 'rewatchable'] });
  assert.equal(changesSchema.parse({ status: 'watched', reaction: '', tags: [] }).reaction, null);
  for (const data of [
    { status: 'finished', reaction: '5', tags: [] },
    { status: 'watched', reaction: '0', tags: [] },
    { status: 'watched', reaction: '6', tags: [] },
    { status: 'watched', reaction: '4', tags: ['spoiler'] },
    { status: 'watched', reaction: '4', tags: ['boring', 'boring'] },
  ]) assert.equal(changesSchema.safeParse(data).success, false);
  assert.equal(entryInputSchema.safeParse({ mediaType: 'movie', id: '01', intent: 'save' }).success, false);
  assert.equal(entryInputSchema.parse({ mediaType: 'tv', id: '42', intent: 'restore' }).id, 42);
});

test('filters, preferences and repeated scalar fields are bounded', () => {
  assert.equal(libraryFiltersSchema.parse({ reaction: 'unrated' }).page, 1);
  for (const data of [{ page: '10001' }, { status: 'random' }, { type: ['movie','tv'] }, { reaction: '10' }]) assert.equal(libraryFiltersSchema.safeParse(data).success, false);
  assert.deepEqual(preferencesSchema.parse(['18','35']), [18,35]);
  for (const values of [['18','18'], ['-1'], Array(31).fill('18'), ['1.5']]) assert.equal(preferencesSchema.safeParse(values).success, false);
  const form = new FormData(); form.append('id','42'); assert.equal(scalar(form,'id'),'42');
  form.append('id','43'); assert.equal(scalar(form,'id'),undefined);
});
