import { expect, test } from '@playwright/test';

test('mobile launch-to-results loop, upgrade, pause, and restart stay healthy', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/?debug=1');
  await expect(page.locator('#title-screen')).toHaveClass(/is-active/);
  await expect(page.locator('#debug-panel')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('title-mobile.png'), fullPage: true });

  await page.locator('#start-button').click();
  await expect(page.locator('#hint-screen')).toHaveClass(/is-active/);
  await page.locator('#arm-button').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'launch');

  const canvas = page.locator('#game-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error('Canvas has no interactive bounds.');
  await page.mouse.move(bounds.x + bounds.width * 0.42, bounds.y + bounds.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.62, { steps: 5 });
  await page.waitForTimeout(1_900);
  await page.screenshot({ path: testInfo.outputPath('launch-charge-mobile.png'), fullPage: true });
  await page.mouse.up();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'ascent');
  await expect(page.locator('#hud')).toHaveClass(/is-visible/);
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath('ascent-mobile.png'), fullPage: true });

  await page.locator('#debug-orbit').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'orbit');
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath('orbit-mobile.png'), fullPage: true });

  await page.locator('#pause-button').click();
  await expect(page.locator('#pause-screen')).toHaveClass(/is-active/);
  const pausedSnapshot = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(pausedSnapshot?.paused).toBe(true);
  await page.locator('#resume-button').click();
  await expect(page.locator('#pause-screen')).not.toHaveClass(/is-active/);

  await page.locator('#debug-boss').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'boss');
  await page.waitForTimeout(2_600);
  await page.screenshot({ path: testInfo.outputPath('boss-mobile.png'), fullPage: true });
  await page.evaluate(() => {
    for (let hit = 0; hit < 8; hit += 1) window.__PASCAL_B_DEBUG__?.damageBoss(1);
  });
  await page.waitForTimeout(80);
  await page.screenshot({ path: testInfo.outputPath('mothership-destruction-mobile.png'), fullPage: true });
  await expect(page.locator('#results-screen')).toHaveClass(/is-active/, { timeout: 8_000 });
  await expect(page.locator('#result-mothership')).toHaveText('DESTROYED');
  await expect(page.locator('#result-score')).not.toHaveText('0');
  await page.screenshot({ path: testInfo.outputPath('results-mobile.png'), fullPage: true });

  const firstUpgrade = page.locator('[data-upgrade="launchPressure"]');
  await expect(firstUpgrade).toBeEnabled();
  await firstUpgrade.click();
  const savedLevel = await page.evaluate(() => {
    const raw = localStorage.getItem('pascal-b-cover-fire:v1');
    return raw ? (JSON.parse(raw) as { upgrades: { launchPressure: number } }).upgrades.launchPressure : -1;
  });
  expect(savedLevel).toBe(1);

  await page.locator('#replay-button').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'launch');
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.6);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'ascent');

  await page.locator('#debug-orbit').click();
  await page.locator('#debug-boss').click();
  await page.evaluate(() => {
    for (let hit = 0; hit < 8; hit += 1) window.__PASCAL_B_DEBUG__?.damageBoss(1);
  });
  await expect(page.locator('#results-screen')).toHaveClass(/is-active/, { timeout: 8_000 });
  const secondRunPools = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(secondRunPools?.targets).toBeLessThanOrEqual(30);
  expect(secondRunPools?.particles).toBeLessThanOrEqual(120);
  expect(secondRunPools?.haloOrbiters).toBeLessThanOrEqual(28);

  const documentMetrics = await page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    selectedText: window.getSelection()?.toString() ?? '',
  }));
  expect(documentMetrics.scrollY).toBe(0);
  expect(documentMetrics.scrollWidth).toBeLessThanOrEqual(documentMetrics.viewportWidth);
  expect(documentMetrics.selectedText).toBe('');
  expect(consoleErrors).toEqual([]);
});

test('normal play omits visible debug tooling', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#title-screen')).toHaveClass(/is-active/);
  await expect(page.locator('#debug-panel')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'title');
});

test('natural phase timers carry a charged launch into orbit and the interception', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?debug=1');
  await page.clock.runFor(1_100);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'title');
  await page.locator('#start-button').click();
  await page.locator('#arm-button').click();

  const canvas = page.locator('#game-canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Canvas has no interactive bounds.');
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.6);
  await page.mouse.down();
  await page.clock.runFor(1_500);
  await page.mouse.up();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'ascent');

  await page.clock.runFor(16_000);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'orbit');

  let reachedBoss = false;
  for (let second = 0; second < 40; second += 1) {
    await page.clock.runFor(1_000);
    const phase = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot().phase);
    if (phase === 'boss') {
      reachedBoss = true;
      break;
    }
  }
  expect(reachedBoss).toBe(true);

  await page.evaluate(() => {
    for (let hit = 0; hit < 8; hit += 1) window.__PASCAL_B_DEBUG__?.damageBoss(1);
  });
  await page.clock.runFor(3_500);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'results');
  await expect(page.locator('#result-mothership')).toHaveText('DESTROYED');
});
