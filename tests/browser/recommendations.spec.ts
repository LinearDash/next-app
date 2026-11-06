import { test, expect, type Page } from "@playwright/test";
import { service, bob, session } from "./session";

const tmdb = "http://127.0.0.1:4519/tmdb";

test.beforeEach(async ({ page, request }) => {
  await request.post(`${service}/__control`);
  await request.post(`${tmdb}/__control?mode=normal`);
  await page.route("https://image.tmdb.org/**", (route) => route.abort());
});

async function rate(page: Page, path: string, status: string, reaction: string) {
  await page.goto(path);
  await page.getByLabel("Watch status").selectOption(status);
  await page.getByLabel("Your reaction", { exact: true }).selectOption(reaction);
  await page.getByRole("button", { name: "Save to library", exact: true }).click();
  await expect(page.getByText("Saved to your library.", { exact: true })).toBeVisible();
}
const section = (page: Page, name: string) => page.getByRole("region", { name });

test("cold start shows labeled popular fallback for each media type without discover traffic", async ({
  page,
  context,
  request,
}) => {
  await session(context);
  await page.goto("/for-you");
  await expect(page.getByText(/There isn’t enough rating history yet/)).toBeVisible();
  for (const [name, titles] of [
    ["Movies for you", ["The Last Lighthouse", "Another Movie"]],
    ["TV series for you", ["Lighthouse Diaries", "Another Series"]],
  ] as const) {
    for (const title of titles)
      await expect(section(page, name).getByRole("heading", { name: title })).toBeVisible();
    await expect(section(page, name).getByText("Popular on TMDB right now")).toHaveCount(2);
  }
  await expect(page.locator("main")).not.toContainText(/%|probab|chance/i);
  const requests = await (await request.get(`${tmdb}/__requests`)).json();
  expect(requests.some((entry: { path: string }) => entry.path.includes("/discover/"))).toBe(false);
});

test("reactions drive explained picks; watched, dismissed and disliked titles are excluded; other users unaffected", async ({
  page,
  context,
  browser,
}) => {
  await session(context);
  await rate(page, "/title/movie/43", "watched", "5"); // Comedy, loved
  await rate(page, "/title/movie/42", "watched", "1"); // Drama, hated
  await rate(page, "/title/tv/44", "want_to_watch", "");
  await page.goto("/for-you");
  const movies = section(page, "Movies for you"),
    tv = section(page, "TV series for you");
  await expect(movies.getByRole("heading", { name: "Laugh Track" })).toBeVisible();
  await expect(movies.getByText("Matches genres you rated highly: Comedy")).toBeVisible();
  for (const watched of ["Another Movie", "The Last Lighthouse"])
    await expect(movies.getByRole("heading", { name: watched })).toHaveCount(0);
  await expect(tv.getByRole("heading", { name: "Lighthouse Diaries" })).toHaveCount(0); // hated genre, not suggested even as popular fill
  await expect(
    tv.locator("article").filter({ hasText: "Sitcom Nights" }).getByText("On your watchlist"),
  ).toBeVisible();
  await expect(tv.getByRole("heading", { name: "Another Series" })).toBeVisible();
  // "Laugh Track"/"Sitcom Nights" are only returned by the stand-in's /discover with Comedy (35) and valid params.
  // (Its request log drops entries under concurrent requests, so it isn't asserted here.)

  await movies
    .locator("article")
    .filter({ hasText: "Laugh Track" })
    .getByRole("button", { name: "Not interested" })
    .click();
  await expect(movies.getByRole("heading", { name: "Laugh Track" })).toHaveCount(0);
  await expect(movies.getByText(/Nothing new to suggest right now/)).toBeVisible();

  const other = await browser.newContext();
  await session(other, bob);
  const b = await other.newPage();
  await b.goto("http://127.0.0.1:3417/for-you");
  await expect(b.getByText(/There isn’t enough rating history yet/)).toBeVisible();
  await expect(
    section(b, "Movies for you").getByRole("heading", { name: "The Last Lighthouse" }),
  ).toBeVisible();
  await other.close();

  await page.goto("/library?view=dismissed");
  await page.getByRole("link", { name: "Edit Laugh Track" }).click();
  await page.getByRole("button", { name: "Undo not interested" }).click();
  await expect(page.getByText("You haven’t dismissed any matching titles.")).toBeVisible();
  await page.goto("/for-you");
  await expect(movies.getByRole("heading", { name: "Laugh Track" })).toBeVisible();
});

test("chosen genres personalize before any ratings exist", async ({ page, context }) => {
  await session(context);
  await page.goto("/onboarding");
  await page.getByRole("checkbox", { name: "Comedy", exact: true }).check();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page).toHaveURL("/library");
  await page.goto("/for-you");
  await expect(page.getByText(/Based on the genres you chose/)).toBeVisible();
  const movies = section(page, "Movies for you");
  await expect(movies.locator("article").first()).toContainText("Laugh Track");
  await expect(movies.getByText("Matches genres you chose: Comedy").first()).toBeVisible();
});

test("catalog outages degrade per section and the page stays usable", async ({
  page,
  context,
  request,
}) => {
  await session(context);
  await request.post(`${tmdb}/__control?mode=partial`);
  await page.goto("/for-you");
  await expect(
    section(page, "Movies for you").getByText("The catalog is taking an intermission."),
  ).toBeVisible();
  await expect(
    section(page, "TV series for you").getByRole("heading", { name: "Lighthouse Diaries" }),
  ).toBeVisible();
  await request.post(`${tmdb}/__control?mode=outage`);
  await page.reload();
  await expect(page.getByText("The catalog is taking an intermission.")).toHaveCount(2);
});

test("signed-out visitors are sent to login", async ({ page }) => {
  await page.goto("/for-you");
  await expect(page).toHaveURL("/login");
});

for (const width of [320, 768, 1440]) {
  test(`for-you fits ${width}px and is not publicly cached`, async ({ page, context }) => {
    await session(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/for-you");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("For you.");
    await expect(page.getByRole("button", { name: "Not interested" }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await context.request.get("http://127.0.0.1:3417/for-you")).headers()["cache-control"],
    ).toContain("no-store");
    if (width === 320)
      await page.screenshot({ path: "/tmp/iiwi-phase4-mobile.png", fullPage: true });
  });
}
