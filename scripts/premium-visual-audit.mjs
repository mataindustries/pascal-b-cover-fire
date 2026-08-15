import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import path from 'node:path';

const outputDirectory = process.env.PASCAL_B_AUDIT_DIR ?? '/tmp/pascal-b-premium-audit';
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
  colorScheme: 'dark',
});
const page = await context.newPage();
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

await page.goto('http://127.0.0.1:4173/?debug=1');
await page.waitForFunction(() => document.body.dataset.phase === 'title');
await page.evaluate(() => window.__PASCAL_B_DEBUG__?.enterArena());
await page.waitForTimeout(420);
await page.locator('#debug-panel').evaluate((panel) => panel.setAttribute('style', 'display: none !important'));
await page.screenshot({ path: path.join(outputDirectory, 'early-play.png'), fullPage: true });

await page.evaluate(() => {
  window.__PASCAL_B_DEBUG__?.spawnFormation('mixed');
  window.__PASCAL_B_DEBUG__?.spawnFormation('wedge');
  window.__PASCAL_B_DEBUG__?.spawnFormation('minefield');
});
await page.waitForTimeout(520);
await page.screenshot({ path: path.join(outputDirectory, 'dense-play.png'), fullPage: true });

await page.evaluate(() => {
  window.__PASCAL_B_DEBUG__?.fillBurst();
  window.__PASCAL_B_DEBUG__?.coreBurst();
});
await page.waitForTimeout(220);
await page.screenshot({ path: path.join(outputDirectory, 'core-burst.png'), fullPage: true });

await page.evaluate(() => window.__PASCAL_B_DEBUG__?.premiumGallery());
await page.waitForTimeout(220);
await page.screenshot({ path: path.join(outputDirectory, 'premium-roster.png'), fullPage: true });

await page.evaluate(() => window.__PASCAL_B_DEBUG__?.focusPremium('luxurySpaceYacht'));
for (let section = 0; section < 5; section += 1) {
  await page.evaluate(() => window.__PASCAL_B_DEBUG__?.damagePremium());
}
await page.evaluate(() => window.__PASCAL_B_DEBUG__?.destroyPremium());
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outputDirectory, 'yacht-destruction.png'), fullPage: true });

await page.evaluate(() => window.__PASCAL_B_DEBUG__?.focusPremium('orbitalDatacenter'));
for (let wing = 0; wing < 4; wing += 1) {
  await page.evaluate(() => window.__PASCAL_B_DEBUG__?.damagePremium());
}
await page.evaluate(() => window.__PASCAL_B_DEBUG__?.destroyPremium());
await page.waitForTimeout(380);
await page.screenshot({ path: path.join(outputDirectory, 'datacenter-collapse.png'), fullPage: true });

await page.evaluate(() => {
  window.__PASCAL_B_DEBUG__?.carrierIncursion();
});
await page.waitForTimeout(1_650);
await page.screenshot({ path: path.join(outputDirectory, 'carrier-incursion.png'), fullPage: true });
for (let section = 0; section < 4; section += 1) {
  await page.evaluate(() => window.__PASCAL_B_DEBUG__?.damagePremium());
}
await page.evaluate(() => window.__PASCAL_B_DEBUG__?.destroyPremium());
await page.waitForTimeout(380);
await page.screenshot({ path: path.join(outputDirectory, 'carrier-destruction.png'), fullPage: true });

const samples = [];
for (let index = 0; index < 12; index += 1) {
  await page.waitForTimeout(250);
  samples.push(await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot()));
}
const valid = samples.filter(Boolean);
const last = valid.at(-1);
const summary = {
  viewport: '390x844',
  sampleCount: valid.length,
  minimumFps: Math.min(...valid.map((sample) => sample.fps)),
  averageFps: valid.reduce((total, sample) => total + sample.fps, 0) / valid.length,
  peakTargets: Math.max(...valid.map((sample) => sample.peakTargets)),
  peakParticles: Math.max(...valid.map((sample) => sample.particles)),
  peakPremiumFragments: Math.max(...valid.map((sample) => sample.premiumFragments)),
  premiumAssetsLoaded: last?.premiumAssetsLoaded,
  premiumAssetFailures: last?.premiumAssetFailures,
  texturedTargets: last?.texturedTargets,
  premiumTypesSeen: last?.premiumTypesSeen,
  carrierDrones: last?.carrierDrones,
  errors,
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
await browser.close();
