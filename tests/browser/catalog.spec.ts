import { test, expect } from "@playwright/test";

const simulation = "http://127.0.0.1:4519/tmdb";
test.beforeEach(async ({ page, request }) => {
  await page.route("https://image.tmdb.org/**", route => route.abort());
  await request.post(`${simulation}/__control?mode=normal`);
});

for (const width of [320, 768, 1440]) {
  test(`discovery, search and detail fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    if (width === 320) {
      // Force failed posters to finish before hydration so cached image failures are covered.
      await page.route("**/_next/static/**/*.js", async route => {
        await new Promise(resolve => setTimeout(resolve, 400));
        await route.continue();
      });
    }
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "Popular movies" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Popular TV series" })).toBeVisible();
    await page.locator(".title-card").first().scrollIntoViewIfNeeded();
    await expect(page.getByRole("img", { name: "The Last Lighthouse: poster unavailable" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel("Title", { exact: true }).fill("Lighthouse");
    await page.getByLabel("Title", { exact: true }).press("Tab");
    await expect(page.getByLabel("Search in")).toBeFocused();
    await page.getByLabel("Search in").selectOption("tv");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("heading", { name: /TV series matching/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: /Lighthouse Diaries/ }).click();
    await expect(page).toHaveURL('/title/tv/42');
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lighthouse Diaries");
    await expect(page.getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByText(/not your personal reaction/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => (window as Window & { catalogInjected?: boolean }).catalogInjected)).toBeUndefined();
    if (width === 320) await page.screenshot({ path: '/tmp/iiwi-phase2-mobile.png', fullPage: true });
  });
}

test('movie identity, search encoding, pagination and no typing requests', async ({ page, request }) => {
  await page.goto('/search');
  await page.getByLabel('Title', { exact: true }).fill('A & B / 日本語');
  expect(await (await request.get(`${simulation}/__requests`)).json()).toEqual([]);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Movies matching/ })).toBeVisible();
  await page.getByRole('link', { name: 'Next →' }).click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  const log = await (await request.get(`${simulation}/__requests`)).json();
  expect(log.some((entry: { query: { query: string; page: string }; validBearer: boolean }) => entry.query.query === 'A & B / 日本語' && entry.query.page === '2' && entry.validBearer)).toBe(true);
  await page.goto('/title/movie/42');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Last Lighthouse');
  await expect(page.getByText('112 minutes')).toBeVisible();
});

test('invalid searches never call the provider; empty results and title 404 recover', async ({ page, request }) => {
  for (const url of ['/search?q=a', '/search?q=ab&type=person', '/search?q=ab&page=21', '/search?q=ab&q=cd']) {
    await page.goto(url);
    await expect(page.getByRole('status')).toContainText('Use a title');
  }
  expect(await (await request.get(`${simulation}/__requests`)).json()).toEqual([]);
  await page.goto('/search?q=empty');
  await expect(page.getByText('No titles found. Try another search.')).toBeVisible();
  for (const url of ['/title/movie/404', '/title/person/42', '/title/movie/01']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'This one got away.' })).toBeVisible();
  }
});

for (const query of ['unauthorized', 'limited', 'unavailable', 'malformed', 'invalidshape', 'oversized', 'slow']) {
  test(`safe recovery for upstream ${query}`, async ({ page }) => {
    await page.goto(`/search?q=${query}`);
    await expect(page.getByRole('heading', { name: 'The catalog is taking an intermission.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try again →' })).toBeVisible();
    expect(await page.content()).not.toContain('catalog-simulation-token');
    expect(await page.content()).not.toContain('Do not expose provider details');
  });
}

test('partial outage preserves TV and mismatched detail identity is rejected', async ({ page, request }) => {
  await request.post(`${simulation}/__control?mode=partial`);
  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'The catalog is taking an intermission.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lighthouse Diaries' })).toBeVisible();
  await request.post(`${simulation}/__control?mode=normal`);
  await page.getByRole('link', { name: 'Try again →' }).click();
  await expect(page.getByRole('heading', { name: 'The Last Lighthouse' })).toBeVisible();
  await page.goto('/title/movie/999');
  await expect(page.getByRole('heading', { name: 'The catalog is taking an intermission.' })).toBeVisible();
});

test('credits carry official attribution and token never reaches HTML or browser scripts', async ({ page, request }) => {
  await page.goto('/credits');
  await expect(page.getByRole('img', { name: 'The Movie Database (TMDB)' })).toBeVisible();
  await expect(page.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')).toBeVisible();
  await page.goto('/discover');
  expect(await page.content()).not.toContain('catalog-simulation-token');
  for (const script of await page.locator('script[src]').evaluateAll(elements => elements.map(element => (element as HTMLScriptElement).src))) {
    expect(await (await request.get(script)).text()).not.toContain('catalog-simulation-token');
  }
  const log = await (await request.get(`${simulation}/__requests`)).json();
  expect(log.length).toBeGreaterThan(0);
  expect(log.every((entry: { validBearer: boolean }) => entry.validBearer)).toBe(true);
});
