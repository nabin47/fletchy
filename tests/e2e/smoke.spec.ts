import { expect, type Page, test } from '@playwright/test';

const viewports = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

const shot = (page: Page, name: string, vp: { width: number; height: number }): Promise<Buffer> =>
  page.screenshot({ path: `test-results/screenshots/${vp.width}x${vp.height}/${name}.png` });

const screen = (page: Page): Promise<string> => page.evaluate(() => window.__fletchy?.debug?.screen() ?? '');

/** Taps a free arrow with a real pointer event, exercising the input mapping. */
async function tapFreeArrow(page: Page): Promise<void> {
  const p = await page.evaluate(() => window.__fletchy?.debug?.freeArrowCenter() ?? null);
  expect(p).not.toBeNull();
  if (p) await page.mouse.click(p.x, p.y);
}

for (const vp of viewports) {
  test(`plays through every screen at ${vp.width}x${vp.height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await page.setViewportSize(vp);

    // First run starts with the tutorial.
    await page.goto('./');
    await page.waitForFunction(() => window.__fletchy?.ready === true);
    await expect(page.locator('.tutorial-text')).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, '01-tutorial', vp);
    await tapFreeArrow(page);
    await expect.poll(() => page.evaluate(() => window.__fletchy?.debug?.state().kind)).toBe('tutorial');
    await page.getByRole('button', { name: 'Skip' }).click();

    // Menu.
    await expect(page.getByRole('button', { name: /Rush/ })).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, '02-menu', vp);

    // Rush: real taps, then a screenshot mid-game.
    await page.getByRole('button', { name: /Rush/ }).click();
    expect(await screen(page)).toBe('playing');
    for (let i = 0; i < 5; i++) {
      await tapFreeArrow(page);
      await page.waitForTimeout(120);
    }
    await expect.poll(() => page.evaluate(() => window.__fletchy?.debug?.state().score ?? 0)).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await shot(page, '03-rush', vp);

    // Pause and resume.
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume' }).click();

    // Lose all hearts with wrong taps (let waves arrive if no blocked arrow exists yet).
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.__fletchy?.debug?.tapBlocked());
          return page.evaluate(() => window.__fletchy?.debug?.state().over ?? null);
        },
        { timeout: 30_000, intervals: [200] },
      )
      .toBe('hearts');
    await expect(page.getByTestId('gameover')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tap to retry' })).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, '04-gameover', vp);

    // Daily Grid: solve it with the bot hook.
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: /Daily Grid/ }).click();
    await page.waitForTimeout(400);
    await shot(page, '05-daily', vp);
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.__fletchy?.debug?.tapFree());
          return page.evaluate(() => window.__fletchy?.debug?.state().over ?? null);
        },
        { timeout: 30_000, intervals: [50] },
      )
      .toBe('done');
    await expect(page.getByTestId('daily-result')).toBeVisible();
    await expect(page.getByText('Solved!')).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, '06-daily-result', vp);

    // Settings.
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('button', { name: /Sound/ })).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, '07-settings', vp);

    // Progress persisted: the menu shows the best score and today's Daily as done.
    await page.reload();
    await page.waitForFunction(() => window.__fletchy?.ready === true);
    await expect(page.getByRole('button', { name: /Rush/ })).toContainText('Best');
    await expect(page.getByRole('button', { name: /Daily Grid/ })).toContainText('Done today');

    expect(errors).toEqual([]);
  });
}

test('offline assets are served', async ({ request }) => {
  for (const path of ['manifest.webmanifest', 'sw.js', 'privacy.html']) {
    const res = await request.get(path);
    expect(res.ok(), path).toBe(true);
  }
  const manifest = (await (await request.get('manifest.webmanifest')).json()) as { name: string; start_url: string };
  expect(manifest.name).toBe('Fletchy');
  expect(manifest.start_url).toBe('./');
});
