import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTaste, topGenres, recommend } from '../src/lib/recommend.ts';

const DRAMA = 18, COMEDY = 35, HORROR = 27, SCIFI = 878;
const names = new Map([[DRAMA, 'Drama'], [COMEDY, 'Comedy'], [HORROR, 'Horror'], [SCIFI, 'Science Fiction']]);
const t = (id, genreIds, mediaType = 'movie') => ({ id, mediaType, genreIds, title: `T${id}`, date: '', overview: '', posterPath: null, communityScore: 7, voteCount: 100, language: 'en' });
const ids = picks => picks.map(pick => pick.title.id);
const none = new Set();

test('cold start: no ratings or genres falls back to popularity order with an honest reason', () => {
  const taste = buildTaste([], []);
  assert.deepEqual(topGenres(taste), []);
  const picks = recommend([t(1, [HORROR]), t(2, [DRAMA]), t(3, [])], taste, none, none, names);
  assert.deepEqual(ids(picks), [1, 2, 3]);
  assert.ok(picks.every(pick => pick.reason === 'Popular on TMDB right now'));
});

test('liked genres rank first; disliked genres are never suggested; "okay" is neutral', () => {
  const taste = buildTaste([{ genreIds: [DRAMA], reaction: 5 }, { genreIds: [HORROR], reaction: 1 }, { genreIds: [SCIFI], reaction: 3 }], []);
  assert.deepEqual(topGenres(taste), [DRAMA]);
  const picks = recommend([t(1, [HORROR]), t(2, [SCIFI]), t(3, [DRAMA])], taste, none, none, names);
  assert.deepEqual(ids(picks), [3, 2]);
  assert.equal(picks[0].reason, 'Matches genres you rated highly: Drama');
  assert.equal(picks[1].reason, 'Popular on TMDB right now');
});

test('mixed tastes: a loved genre can outweigh a mildly disliked one, but not a hated one', () => {
  const taste = buildTaste([{ genreIds: [COMEDY], reaction: 5 }, { genreIds: [COMEDY], reaction: 5 }, { genreIds: [HORROR], reaction: 2 }, { genreIds: [DRAMA], reaction: 1 }, { genreIds: [DRAMA], reaction: 1 }, { genreIds: [DRAMA], reaction: 1 }], []);
  const picks = recommend([t(1, [COMEDY, HORROR]), t(2, [COMEDY, DRAMA])], taste, none, none, names);
  assert.deepEqual(ids(picks), [1]);
});

test('explicit genre preferences personalize sparse histories', () => {
  const taste = buildTaste([], [SCIFI]);
  assert.deepEqual(topGenres(taste), [SCIFI]);
  const picks = recommend([t(1, [DRAMA]), t(2, [SCIFI])], taste, none, none, names);
  assert.deepEqual(ids(picks), [2, 1]);
  assert.equal(picks[0].reason, 'Matches genres you chose: Science Fiction');
});

test('exclusions use media type + ID; watchlist items stay and are marked; duplicates collapse', () => {
  const taste = buildTaste([], []);
  const excluded = new Set(['movie:1', 'tv:3']);
  const picks = recommend([t(1, []), t(1, [], 'tv'), t(2, []), t(2, []), t(3, [], 'tv')], taste, excluded, new Set(['movie:2']), names);
  assert.deepEqual(picks.map(pick => `${pick.title.mediaType}:${pick.title.id}`), ['tv:1', 'movie:2']);
  assert.deepEqual(picks.map(pick => pick.onWatchlist), [false, true]);
});

test('diversity: one strong genre cannot fill every slot; output makes no probability claims', () => {
  const taste = buildTaste([{ genreIds: [DRAMA], reaction: 5 }, { genreIds: [COMEDY], reaction: 4 }], []);
  const candidates = [t(1, [DRAMA]), t(2, [DRAMA]), t(3, [DRAMA]), t(4, [COMEDY])];
  const picks = recommend(candidates, taste, none, none, names, 3);
  assert.deepEqual(ids(picks), [1, 4, 2]);
  assert.ok(picks.every(pick => !/%|percent|probab|chance/i.test(pick.reason)));
});
