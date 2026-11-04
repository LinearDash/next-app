import { test, expect } from "@playwright/test";

for (const width of [320, 768, 1440]) {
  test(`home and account setup fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Life’s too short");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: /Make yourself at home/ }).click();
    await expect(page.getByRole("heading", { name: "Account access is being set up." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Google/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Account access is being set up." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('callback rejects missing code and ignores external redirects', async ({ request }) => {
  const response = await request.get('/auth/callback?next=https://evil.example', { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('https://iiwi.example/login?error=callback');
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
});

test('private shell is not cached and missing routes recover', async ({ page, request }) => {
  const response = await request.get('/settings');
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  await page.goto('/missing-scene');
  await expect(page.getByRole('heading', { name: 'This one got away.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL('/');
});
