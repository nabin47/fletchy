import { expect, type Page, test } from '@playwright/test';

/*
 * Raw store screenshots at 1080x1920 (9:16; Play rejects anything taller than 2:1).
 * scripts/make-store-assets.mjs adds the captions from app.config.json.
 */
test.use({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405 });

const shot = (page: Page, name: string): Promise<Buffer> => page.screenshot({ path: `test-results/store/${name}.png` });
const dbg = <T>(page: Page, fn: (d: FletchyDebug) => T): Promise<T> =>
  page.evaluate(`(${fn.toString()})(window.__fletchy.debug)`) as Promise<T>;

async function tapFree(page: Page): Promise<void> {
  const p = await page.evaluate(() => window.__fletchy?.debug?.freeArrowCenter() ?? null);
  if (p) await page.mouse.click(p.x, p.y);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fletchy.tutorialDone', 'true');
    localStorage.setItem('fletchy.rushBest', JSON.stringify({ score: 150, wave: 3 }));
  });
  await page.goto('./');
  await page.waitForFunction(() => window.__fletchy?.ready === true);
});

test('store screenshots', async ({ page }) => {
  // Rush starts on a full maze: the busiest board of the round.
  await dbg(page, (d) => d.startRush(20261025));
  await page.waitForTimeout(500);
  await shot(page, 'rush-busy');

  // Mid-tap: arrows sliding out, popups and particles visible.
  for (let i = 0; i < 6; i++) await dbg(page, (d) => d.tapFree());
  await page.waitForTimeout(700);
  for (let i = 0; i < 3; i++) {
    await tapFree(page);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(60);
  await shot(page, 'rush');

  // Game over with a new best: clear arrows to beat 150, then miss three times.
  for (let i = 0; i < 40 && (await dbg(page, (d) => d.state().score)) < 400; i++) {
    await dbg(page, (d) => d.tapFree());
  }
  await expect
    .poll(async () => {
      await dbg(page, (d) => d.tapBlocked());
      return dbg(page, (d) => d.state().over);
    }, { timeout: 30_000, intervals: [200] })
    .toBe('hearts');
  await expect(page.getByText('New best!')).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, 'gameover');

  // Daily Grid, a few arrows in.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Daily Grid/ }).click();
  await page.waitForTimeout(400);
  for (let i = 0; i < 4; i++) {
    await tapFree(page);
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(500);
  await shot(page, 'daily');

  // A boss level, a few arrows in.
  await dbg(page, (d) => d.startLevel(10));
  await page.waitForTimeout(400);
  for (let i = 0; i < 6; i++) {
    await tapFree(page);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(500);
  await shot(page, 'levels');
  await dbg(page, (d) => d.startDaily());
  await expect.poll(() => dbg(page, (d) => d.state().kind)).toBe('daily');

  // Daily result.
  await expect
    .poll(async () => {
      await dbg(page, (d) => d.tapFree());
      return dbg(page, (d) => d.state().over);
    }, { timeout: 30_000, intervals: [50] })
    .toBe('done');
  await expect(page.getByTestId('daily-result')).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, 'daily-result');
});
