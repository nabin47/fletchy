import { expect, test } from '@playwright/test';

const viewports = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

for (const viewport of viewports) {
  test(`loads without console errors at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.locator('h1')).toHaveText('Fletchy');
    await page.waitForFunction(() => window.__fletchy?.ready === true);
    await page.screenshot({ path: `test-results/screenshots/home-${viewport.width}x${viewport.height}.png` });

    expect(errors).toEqual([]);
  });
}
