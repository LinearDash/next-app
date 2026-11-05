import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchSchema, idSchema, parseList, parseMultiList, parseDetail } from '../src/lib/catalog.ts';
import { posterUrl } from '../src/lib/poster.ts';

const base = { id: 42, poster_path: null, overview: '', vote_average: 8.2, vote_count: 20 };
test('movie and TV collisions stay separate; untrusted response fields are validated', () => {
  const movie = parseList({ page: 1, total_pages: 800, results: [{ ...base, title: 'Movie' }, { ...base, id: 43, title: 'Adult', adult: true }] }, 'movie');
  const tv = parseList({ page: 1, total_pages: 1, results: [{ ...base, name: 'Show' }] }, 'tv');
  assert.equal(movie.titles.length, 1);
  assert.equal(movie.totalPages, 20);
  assert.equal(movie.titles[0].mediaType, 'movie');
  assert.equal(tv.titles[0].mediaType, 'tv');
  assert.equal(tv.titles[0].title, 'Show');
  assert.throws(() => parseList({ page: 1, total_pages: 1, results: [{ ...base, name: 'Wrong media' }] }, 'movie'));
  assert.throws(() => parseList({ page: 1, total_pages: 1, results: [{ ...base, title: 'Bad', vote_average: 900 }] }, 'movie'));
  assert.equal(parseDetail({ ...base, title: 'Movie', genres: [], runtime: 100 }, 'movie').runtime, 100);
  assert.equal(parseDetail({ ...base, name: 'Show', genres: [], number_of_seasons: 2 }, 'tv').seasons, 2);
});

test('search, IDs and poster paths reject injection and out-of-budget values', () => {
  assert.equal(searchSchema.parse({ q: '  two words  ' }).q, 'two words');
  for (const input of [{ q: 'a' }, { q: 'x'.repeat(101) }, { q: ['a', 'b'] }, { q: 'movie', type: 'person' }, { q: 'movie', page: '21' }, { q: 'movie', page: '1.5' }]) assert.equal(searchSchema.safeParse(input).success, false);
  for (const id of ['-1', '0', '01', '1/../2', '2147483648']) assert.equal(idSchema.safeParse(id).success, false);
  assert.equal(idSchema.parse('42'), 42);
  assert.equal(posterUrl('/safe-name.jpg'), 'https://image.tmdb.org/t/p/w342/safe-name.jpg');
  for (const path of [null, 'https://evil.example/a.jpg', '//evil.example/a.jpg', '/../../a.jpg', '/a.svg', '/a.jpg?token=secret']) assert.equal(posterUrl(path), null);
});

test('combined search keeps movie/TV identity, drops people and rejects malformed titles', () => {
  const result = parseMultiList({ page: 1, total_pages: 3, results: [
    { ...base, media_type: 'movie', title: 'Movie' }, { ...base, media_type: 'tv', name: 'Show' },
    { id: 7, media_type: 'person', name: 'Someone' }, { ...base, media_type: 'movie', title: 'Duplicate' },
  ] });
  assert.deepEqual(result.titles.map(t => `${t.mediaType}:${t.id}:${t.title}`), ['movie:42:Movie', 'tv:42:Show']);
  assert.equal(searchSchema.parse({ q: 'ab' }).type, 'all');
  assert.throws(() => parseMultiList({ page: 1, total_pages: 1, results: [{ ...base, media_type: 'movie', name: 'Wrong shape' }] }));
});
