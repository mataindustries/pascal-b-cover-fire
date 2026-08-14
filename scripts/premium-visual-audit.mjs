import { chromium } from 'playwright';
import path from 'node:path';

const outputDirectory = process.env.PASCAL_B_AUDIT_DIR ?? '/tmp/pascal-b-premium-audit';
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
await page.waitForTimeout(1_100);
await page.locator('#debug-panel').evaluate((panel) => {
  panel.setAttribute('style', 'display: none !important');
});
await page.screenshot({ path: path.join(outputDirectory, 'premium-field.png'), fullPage: true });

const premiumKinds = [
  'communicationsSatellite',
  'goldTelescope',
  'fuelDepot',
  'solarPowerStation',
  'observationModule',
  'alienInterceptor',
];
for (const art of premiumKinds) {
  await page.evaluate((kind) => window.__PASCAL_B_DEBUG__?.spawnPremium(kind), art);
}
await page.waitForTimeout(420);
await page.screenshot({ path: path.join(outputDirectory, 'premium-roster.png'), fullPage: true });

await page.evaluate(() => {
  window.__PASCAL_B_DEBUG__?.fillBurst();
  window.__PASCAL_B_DEBUG__?.coreBurst();
});
await page.waitForTimeout(320);
await page.screenshot({ path: path.join(outputDirectory, 'premium-destruction.png'), fullPage: true });

await page.evaluate(() => window.__PASCAL_B_DEBUG__?.startMothership());
await page.waitForTimeout(1_900);
await page.evaluate(() => window.__PASCAL_B_DEBUG__?.breachBoss());
await page.waitForTimeout(320);
await page.screenshot({ path: path.join(outputDirectory, 'mothership-damage.png'), fullPage: true });
await page.evaluate(() => window.__PASCAL_B_DEBUG__?.destroyBoss());
await page.waitForTimeout(1_180);
await page.screenshot({ path: path.join(outputDirectory, 'mothership-breakup.png'), fullPage: true });

const samples = [];
for (let index = 0; index < 12; index += 1) {
  await page.waitForTimeout(250);
  samples.push(await page.evaluate(() => window.__PASCAL_B_DEBUG__?.snapshot()));
}
const valid = samples.filter(Boolean);
const summary = {
  viewport: '390x844',
  sampleCount: valid.length,
  minimumFps: Math.min(...valid.map((sample) => sample.fps)),
  averageFps: valid.reduce((total, sample) => total + sample.fps, 0) / valid.length,
  peakTargets: Math.max(...valid.map((sample) => sample.peakTargets)),
  peakParticles: Math.max(...valid.map((sample) => sample.particles)),
  peakPremiumFragments: Math.max(...valid.map((sample) => sample.premiumFragments)),
  premiumAssetsLoaded: valid.at(-1)?.premiumAssetsLoaded,
  premiumAssetFailures: valid.at(-1)?.premiumAssetFailures,
  errors,
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
await browser.close();
