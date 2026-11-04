import { test, expect, type Page } from "@playwright/test";
import { service, alice, bob, session } from "./session";

// Library shelf: selecting a poster opens the side editor for that title.
async function openEditor(page: Page, name: string) {
  await page.getByRole('link', { name: `Edit ${name}` }).click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${service}/__control`);
  await request.post("http://127.0.0.1:4519/tmdb/__control?mode=normal");
  await page.route("https://image.tmdb.org/**", route => route.abort());
});

test('save/edit/remove persist across refresh and a second device with isolated owners', async ({ page, context, browser, request }) => {
  await session(context);
  await page.goto('/title/movie/42');
  const form = page.getByRole('form', { name: 'Personal library entry' });
  await expect(form).toBeVisible();
  await form.getByLabel('Watch status').selectOption('watching');
  await form.getByLabel('Your reaction', { exact: true }).selectOption('5');
  await form.getByLabel('rewatchable', { exact: true }).check();
  await form.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByText('Saved to your library.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Watch status')).toHaveValue('watching');
  await expect(page.getByLabel('Your reaction', { exact: true })).toHaveValue('5');
  await expect(page.getByLabel('rewatchable', { exact: true })).toBeChecked();

  const device = await browser.newContext();
  await session(device);
  const other = await device.newPage();
  await other.goto('http://127.0.0.1:3417/library');
  await openEditor(other, 'The Last Lighthouse');
  await expect(other.getByLabel('Your reaction', { exact: true })).toHaveValue('5');
  await device.close();

  const otherUser = await browser.newContext();
  await session(otherUser, bob);
  const b = await otherUser.newPage();
  await b.goto('http://127.0.0.1:3417/library');
  await expect(b.getByText(/No saved titles match/)).toBeVisible();
  await b.goto('http://127.0.0.1:3417/title/movie/42');
  await b.getByLabel('Your reaction', { exact: true }).selectOption('1');
  // Forging an owner field cannot influence the server-derived owner.
  await b.getByRole('form', { name: 'Personal library entry' }).evaluate(form => {
    const input = document.createElement('input'); input.name = 'owner'; input.value = '00000000-0000-0000-0000-000000000001'; form.append(input);
  });
  await b.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(b.getByText('Saved to your library.', { exact: true })).toBeVisible();
  const state = await (await request.get(`${service}/__state`)).json();
  expect(state.entries.find((entry: { owner: string }) => entry.owner === alice).reaction).toBe(5);
  expect(state.entries.find((entry: { owner: string }) => entry.owner === bob).reaction).toBe(1);
  await otherUser.close();

  await page.getByLabel('Watch status').selectOption('watched');
  await page.getByLabel('Your reaction', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByText('Saved to your library.', { exact: true })).toBeVisible();
  await page.goto('/library?reaction=unrated&status=watched&type=movie');
  await openEditor(page, 'The Last Lighthouse');
  await expect(page.getByLabel('Your reaction', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText(/No saved titles match/)).toBeVisible();
  expect((await (await request.get(`${service}/__state`)).json()).entries.map((entry: { owner: string }) => entry.owner)).toEqual([bob]);
});

test('movie/TV identity, filters and reversible dismissal keep personal ratings', async ({ page, context }) => {
  await session(context);
  for (const [type, reaction] of [['movie', '4'], ['tv', '2']]) {
    await page.goto(`/title/${type}/42`);
    await page.getByLabel('Your reaction', { exact: true }).selectOption(reaction);
    await page.getByRole('button', { name: 'Save to library', exact: true }).click();
    await expect(page.getByText('Saved to your library.', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Not interested', exact: true }).click();
  await expect(page.getByText('Marked not interested. You can undo this in your library.')).toBeVisible();
  await expect(page.getByLabel('Your reaction', { exact: true })).toHaveValue('2');
  await page.goto('/library?type=movie&reaction=4');
  await expect(page.getByRole('link', { name: /The Last Lighthouse/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Lighthouse Diaries/ })).toHaveCount(0);
  await page.goto('/library?view=dismissed');
  await openEditor(page, 'Lighthouse Diaries');
  await page.getByRole('button', { name: 'Undo not interested' }).click();
  await expect(page.getByText('You haven’t dismissed any matching titles.')).toBeVisible();
  await page.goto('/library?type=tv');
  await openEditor(page, 'Lighthouse Diaries');
  await expect(page.getByLabel('Your reaction', { exact: true })).toHaveValue('2');
});

test('optional onboarding persists genres, ratings and skip without erasing preferences', async ({ page, context, request }) => {
  await session(context);
  await page.goto('/onboarding');
  await page.getByRole('checkbox', { name: 'Drama', exact: true }).check();
  const entry = page.getByRole('form', { name: 'Personal library entry' }).first();
  await entry.getByLabel('Your reaction', { exact: true }).selectOption('3');
  await entry.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByText('You’ve rated 1 titles.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page).toHaveURL('/library');
  let state = await (await request.get(`${service}/__state`)).json();
  expect(state.profiles.find((profile: { owner: string }) => profile.owner === alice).genre_preferences).toEqual([18]);
  await page.goto('/onboarding');
  await expect(page.getByRole('checkbox', { name: 'Drama', exact: true })).toBeChecked();
  await request.post('http://127.0.0.1:4519/tmdb/__control?mode=outage');
  await page.reload();
  await expect(page.getByText('Genre choices are temporarily unavailable. You can skip and return later.')).toBeVisible();
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await expect(page).toHaveURL('/library');
  state = await (await request.get(`${service}/__state`)).json();
  expect(state.profiles.find((profile: { owner: string }) => profile.owner === alice).genre_preferences).toEqual([18]);
});

test('failed writes preserve input; expired sessions and invalid reactions never write', async ({ page, context, request }) => {
  await session(context);
  await page.goto('/title/movie/42');
  await page.getByLabel('Your reaction', { exact: true }).selectOption('5');
  await page.getByLabel('interesting', { exact: true }).check();
  await request.post(`${service}/__mode?mode=write-failure`);
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /We couldn’t save/ })).toBeVisible();
  await expect(page.getByLabel('Your reaction', { exact: true })).toHaveValue('5');
  await expect(page.getByLabel('interesting', { exact: true })).toBeChecked();
  expect((await (await request.get(`${service}/__state`)).json()).entries).toEqual([]);
  await request.post(`${service}/__mode?mode=normal`);
  await page.getByLabel('Your reaction', { exact: true }).evaluate(select => { const option = document.createElement('option'); option.value = '6'; option.text = 'Invalid'; select.append(option); });
  await page.getByLabel('Your reaction', { exact: true }).selectOption('6');
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /Please check/ })).toBeVisible();
  expect((await (await request.get(`${service}/__state`)).json()).entries).toEqual([]);
  await page.getByLabel('Your reaction', { exact: true }).selectOption('4');
  await request.post(`${service}/__mode?mode=expired`);
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /session has expired/ })).toBeVisible();
  expect((await (await request.get(`${service}/__state`)).json()).entries).toEqual([]);
  await page.goto('/library');
  await expect(page).toHaveURL('/login');
});

for (const width of [320, 768, 1440]) {
  test(`private library and onboarding fit ${width}px and are not publicly cached`, async ({ page, context, request }) => {
    await session(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/title/movie/42');
    await page.getByRole('button', { name: 'Save to library', exact: true }).click();
    await expect(page.getByText('Saved to your library.', { exact: true })).toBeVisible();
    for (const path of ['/library?edit=movie-42', '/onboarding']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(path !== '/onboarding' ? 'Your library.' : 'Start with what you love.');
      await expect(page.getByRole('button', { name: path !== '/onboarding' ? 'Save' : 'Skip for now', exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const response = await context.request.get(`http://127.0.0.1:3417${path}`);
      expect(response.headers()['cache-control']).toContain('no-store');
    }
    const state = await (await request.get(`${service}/__state`)).json();
    expect(state.requests.some((entry: { method: string; path: string; owner: string }) => entry.method === 'POST' && entry.path === '/rest/v1/library_entries' && entry.owner === alice)).toBe(true);
    if (width === 320) await page.screenshot({ path: '/tmp/iiwi-phase3-mobile.png', fullPage: true });
  });
}

test('catalog outage keeps existing entries editable and removable', async ({ page, context, request }) => {
  await session(context);
  await page.goto('/title/movie/42');
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByText('Saved to your library.', { exact: true })).toBeVisible();
  await request.post('http://127.0.0.1:4519/tmdb/__control?mode=partial');
  await page.goto('/library');
  await openEditor(page, 'Movie #42');
  await page.getByLabel('Watch status').selectOption('dropped');
  await page.getByLabel('Your reaction', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved to your library.', { exact: true })).toBeVisible();
  const state = await (await request.get(`${service}/__state`)).json();
  expect(state.entries[0].status).toBe('dropped');
  expect(state.entries[0].reaction).toBe(2);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText(/No saved titles match/)).toBeVisible();
});

test('cross-origin action requests are rejected before private writes', async ({ page, context, request }) => {
  await session(context);
  await page.goto('/title/movie/42');
  await page.route('**/title/movie/42', async route => {
    if (route.request().method() === 'POST') await route.fulfill({ response: await route.fetch({ headers: { ...route.request().headers(), origin: 'https://untrusted.example' } }) });
    else await route.continue();
  });
  const response = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/title/movie/42'));
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  expect((await response).status()).toBe(500);
  expect((await (await request.get(`${service}/__state`)).json()).entries).toEqual([]);
});

test('unknown genre IDs are rejected without changing private preferences', async ({ page, context, request }) => {
  await session(context);
  await page.goto('/onboarding');
  await page.locator('.preferences-form').evaluate(form => {
    const input = document.createElement('input'); input.type = 'hidden'; input.name = 'genres'; input.value = '99999'; form.append(input);
  });
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please choose genres from the available list.' })).toBeVisible();
  const state = await (await request.get(`${service}/__state`)).json();
  expect(state.profiles.find((profile: { owner: string }) => profile.owner === alice).genre_preferences).toEqual([]);
});

test('selecting a poster on a phone brings the editor into view and focuses it', async ({ page, context, request }) => {
  await request.post(`${service}/__seed?kind=ratings&owner=${alice}&count=8`);
  await session(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/library');
  await expect(page.locator('#editor')).toBeHidden(); // no empty panel on phones
  await page.getByRole('link', { name: /Edit Archive Movie 1006/ }).click();
  const heading = page.getByRole('heading', { level: 2, name: 'Archive Movie 1006' });
  await expect(heading).toBeInViewport();
  await expect(heading).toBeFocused();
  await expect(page.getByRole('link', { name: /Edit Archive Movie 1006/ })).toHaveAttribute('aria-current', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
