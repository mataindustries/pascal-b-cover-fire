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
  await page.waitForTimeout(900);
  await page.screenshot({ path: testInfo.outputPath('orbit-mobile.png'), fullPage: true });
  const openingSnapshot = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(openingSnapshot?.largestCombo).toBeGreaterThanOrEqual(5);
  expect(openingSnapshot?.targets).toBeLessThanOrEqual(50);
  expect(openingSnapshot?.premiumTargets).toBeGreaterThanOrEqual(3);
  expect(openingSnapshot?.premiumTargets).toBeLessThanOrEqual(8);
  expect(openingSnapshot?.premiumAssetsLoaded).toBe(7);
  expect(openingSnapshot?.premiumAssetFailures).toBe(0);

  await page.locator('#debug-mines').click();
  await page.locator('#debug-fill-burst').click();
  const beforeBurst = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  await expect(page.locator('#core-burst-button')).toBeEnabled();
  await page.locator('#core-burst-button').click();
  await page.waitForTimeout(90);
  const afterBurst = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(afterBurst?.mass).toBeLessThan(beforeBurst?.mass ?? 0);
  expect(afterBurst?.peakMass).toBeGreaterThanOrEqual(beforeBurst?.mass ?? 0);
  expect(afterBurst?.burstCharge).toBeLessThan(0.01);
  expect((afterBurst?.burstShards ?? 0) + (afterBurst?.gameplayWaves ?? 0)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('core-burst-mobile.png'), fullPage: true });

  await page.locator('#pause-button').click();
  await expect(page.locator('#pause-screen')).toHaveClass(/is-active/);
  const pausedSnapshot = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(pausedSnapshot?.paused).toBe(true);
  await page.locator('#resume-button').click();
  await expect(page.locator('#pause-screen')).not.toHaveClass(/is-active/);

  await page.locator('#debug-boss').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'boss');
  await page.waitForTimeout(1_900);
  await page.screenshot({ path: testInfo.outputPath('boss-mobile.png'), fullPage: true });
  await page.locator('#debug-breach').click();
  await page.waitForTimeout(240);
  await page.screenshot({ path: testInfo.outputPath('boss-breached-mobile.png'), fullPage: true });
  await page.locator('#debug-breach').click();
  await page.waitForTimeout(240);
  await page.screenshot({ path: testInfo.outputPath('boss-critical-mobile.png'), fullPage: true });
  await page.locator('#debug-destroy-boss').click();
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: testInfo.outputPath('mothership-separation-mobile.png'), fullPage: true });
  await page.waitForTimeout(1_250);
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
  const firstRunSeed = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot().runSeed);

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
    for (let hit = 0; hit < 18; hit += 1) window.__PASCAL_B_DEBUG__?.damageBoss(1);
  });
  await expect(page.locator('#results-screen')).toHaveClass(/is-active/, { timeout: 8_000 });
  const secondRunPools = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(secondRunPools?.targets).toBeLessThanOrEqual(50);
  expect(secondRunPools?.enemies).toBeLessThanOrEqual(50);
  expect(secondRunPools?.particles).toBeLessThanOrEqual(220);
  expect(secondRunPools?.haloOrbiters).toBeLessThanOrEqual(36);
  expect(secondRunPools?.shockwaves).toBeLessThanOrEqual(12);
  expect(secondRunPools?.premiumFragments).toBeLessThanOrEqual(48);
  expect(secondRunPools?.gameplayWaves).toBeLessThanOrEqual(12);
  expect(secondRunPools?.burstShards).toBeLessThanOrEqual(28);
  expect(secondRunPools?.peakTargets).toBeLessThanOrEqual(50);
  expect(secondRunPools?.runSeed).not.toBe(firstRunSeed);

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

test('normal play omits visible debug tooling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('#title-screen')).toHaveClass(/is-active/);
  await expect(page.locator('#debug-panel')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'title');
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath('title-360-normal.png'), fullPage: true });
  await page.locator('#start-button').click();
  await expect(page.locator('#hint-screen')).toHaveClass(/is-active/);
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath('hint-360-normal.png'), fullPage: true });
});

test('short portrait reserves a touch-safe zone for Core Burst', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/?debug=1');
  await page.waitForTimeout(1_050);
  await page.locator('#start-button').click();
  await page.locator('#arm-button').click();
  await page.locator('#debug-orbit').click();
  await page.waitForTimeout(1_000);
  const geometry = await page.evaluate(() => ({
    playerY: window.__PASCAL_B_DEBUG__?.snapshot().playerY ?? 0,
    burstTop: document.querySelector('#core-burst-button')?.getBoundingClientRect().top ?? 0,
    canvas: document.querySelector('#game-canvas')?.getBoundingClientRect(),
  }));
  expect(geometry.canvas).not.toBeNull();
  if (!geometry.canvas) return;
  const scale = geometry.canvas.width / 450;
  const logicalHeight = Math.min(1_000, Math.max(800, 450 * geometry.canvas.height / geometry.canvas.width));
  const verticalOffset = (logicalHeight - 800) * 0.5;
  const maximumHaloBottom = geometry.canvas.top + (geometry.playerY + verticalOffset + 78) * scale;
  expect(maximumHaloBottom).toBeLessThan(geometry.burstTop);
});

test('premium mothership and all reactor anchors fit a 360 by 640 portrait', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/?debug=1');
  await page.evaluate(() => window.__PASCAL_B_DEBUG__?.startMothership());
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'boss');
  await page.waitForTimeout(1_900);
  await page.locator('#debug-panel').evaluate((panel) => {
    panel.setAttribute('style', 'display: none !important');
  });
  await page.screenshot({ path: testInfo.outputPath('mothership-360x640.png'), fullPage: true });

  const weakPoints = [];
  for (let index = 0; index < 3; index += 1) {
    const snapshot = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
    weakPoints.push({ x: snapshot?.weakPointX ?? -1, y: snapshot?.weakPointY ?? -1 });
    if (index < 2) await page.evaluate(() => window.__PASCAL_B_DEBUG__?.breachBoss());
  }
  expect(weakPoints).toEqual([
    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
  ]);
  for (const weakPoint of weakPoints) {
    expect(weakPoint.x).toBeGreaterThanOrEqual(19);
    expect(weakPoint.x).toBeLessThanOrEqual(431);
    expect(weakPoint.y).toBeGreaterThanOrEqual(93);
    expect(weakPoint.y).toBeLessThanOrEqual(600);
  }
  const spriteLoaded = await page.evaluate(() => performance.getEntriesByType('resource')
    .some((entry) => entry.name.endsWith('/assets/ships/pascal-b-mothership.png')));
  expect(spriteLoaded).toBe(true);
});

test('premium target files preload and a failed image falls back without console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.route('**/assets/premium/fuel-depot.webp', (route) => route.fulfill({
    status: 200,
    contentType: 'image/webp',
    body: 'intentionally invalid image payload',
  }));
  await page.goto('/?debug=1');
  await page.evaluate(() => window.__PASCAL_B_DEBUG__?.enterArena());
  await page.waitForTimeout(1_000);
  const snapshot = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(snapshot?.premiumAssetsLoaded).toBe(6);
  expect(snapshot?.premiumAssetFailures).toBe(1);
  expect(snapshot?.premiumTargets).toBeGreaterThanOrEqual(3);
  const assetRequests = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.name.includes('/assets/premium/')).length);
  expect(assetRequests).toBeGreaterThanOrEqual(5);
  expect(consoleErrors).toEqual([]);
});

test('natural phase timers carry a charged launch into orbit and the interception', async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
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

  await page.clock.runFor(3_500);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'orbit');

  await page.clock.runFor(20_000);
  const twentySecondSnapshot = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(twentySecondSnapshot?.phase).toBe('orbit');
  expect(twentySecondSnapshot?.burstCharge).toBeGreaterThanOrEqual(0.65);
  expect(twentySecondSnapshot?.largestCombo).toBeGreaterThanOrEqual(5);
  expect(twentySecondSnapshot?.peakTargets).toBeLessThanOrEqual(50);

  await page.clock.runFor(5_000);
  const twentyFiveSecondSnapshot = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(twentyFiveSecondSnapshot?.burstCharge).toBe(1);
  expect(twentyFiveSecondSnapshot?.mass).toBeGreaterThanOrEqual(15);

  await page.clock.runFor(35_500);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'boss');
  const bossArrival = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  expect(bossArrival?.elapsed).toBeGreaterThanOrEqual(63);
  expect(bossArrival?.elapsed).toBeLessThan(67);

  await page.evaluate(() => {
    for (let hit = 0; hit < 18; hit += 1) window.__PASCAL_B_DEBUG__?.damageBoss(1);
  });
  await page.clock.runFor(3_500);
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'results');
  await expect(page.locator('#result-mothership')).toHaveText('DESTROYED');
});

test('steering and live cascades can breach the mothership without injected damage', async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.install();
  await page.goto('/?debug=1');
  await page.clock.runFor(1_100);
  await page.locator('#start-button').click();
  await page.locator('#arm-button').click();
  await page.evaluate(() => window.__PASCAL_B_DEBUG__?.triggerBoss());
  await page.clock.runFor(1_900);
  const bossStartElapsed = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot().elapsed ?? 0);

  const canvas = page.locator('#game-canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Canvas has no interactive bounds.');
  let usedBurst = false;

  for (let step = 0; step < 72; step += 1) {
    const snapshot = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
    if (!snapshot || snapshot.phase === 'results') break;
    if (snapshot.burstCharge >= 1) {
      await page.locator('#core-burst-button').click();
      usedBurst = true;
    }
    const dx = snapshot.weakPointX - snapshot.playerX;
    const dy = snapshot.weakPointY - snapshot.playerY;
    const length = Math.hypot(dx, dy) || 1;
    const startX = bounds.x + bounds.width * 0.5;
    const startY = bounds.y + bounds.height * 0.56;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + dx / length * 78, startY + dy / length * 78, { steps: 2 });
    await page.clock.runFor(420);
    await page.mouse.up();
    await page.clock.runFor(80);
  }

  await expect(page.locator('#results-screen')).toHaveClass(/is-active/);
  await expect(page.locator('#result-mothership')).toHaveText('DESTROYED');
  expect(usedBurst).toBe(true);
  const finalSnapshot = await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot());
  const activeBossSeconds = (finalSnapshot?.elapsed ?? 0) - bossStartElapsed;
  expect(activeBossSeconds).toBeGreaterThanOrEqual(12);
  expect(activeBossSeconds).toBeLessThanOrEqual(26);
});
