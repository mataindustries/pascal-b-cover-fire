import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(repositoryRoot, 'art-source', 'premium-targets');
const outputDirectory = path.join(repositoryRoot, 'public', 'assets', 'premium');

const assets = [
  ['PASCAL_B_COMMUNICATIONS_SATELLITE.png', 'communications-satellite.webp', 512, 0.9],
  ['PASCAL_B_GOLD_TELESCOPE.png', 'gold-telescope.webp', 512, 0.9],
  ['PASCAL_B_FUEL_DEPOT.png', 'fuel-depot.webp', 512, 0.9],
  ['PASCAL_B_SOLAR_POWER_STATION.png', 'solar-power-station.webp', 512, 0.9],
  ['PASCAL_B_OBSERVATION_MODULE.png', 'observation-module.webp', 512, 0.9],
  ['PASCAL_B_ALIEN_INTERCEPTOR.png', 'alien-interceptor.webp', 512, 0.9],
  // Common bodies are deliberately smaller: their on-screen footprint is 30–48 logical pixels.
  ['PASCAL_B_HUNTER_DRONE.png', 'hunter-drone.webp', 192, 0.82],
  ['PASCAL_B_ANTIMATTER_REACTOR_POD.png', 'antimatter-reactor-pod.webp', 224, 0.84],
  ['PASCAL_B_SHIELDED_CARGO_DRONE.png', 'shielded-cargo-drone.webp', 256, 0.84],
  // Prestige targets retain more source detail for damage overlays and authored crop fragments.
  ['PASCAL_B_LUXURY_SPACE_YACHT.png', 'luxury-space-yacht.webp', 640, 0.89],
  ['PASCAL_B_ORBITAL_DATACENTER.png', 'orbital-datacenter.webp', 640, 0.89],
  ['PASCAL_B_CROWN_DRONE_CARRIER.png', 'crown-drone-carrier.webp', 640, 0.89],
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  for (const [sourceName, outputName, maximumDimension, quality] of assets) {
    const source = await readFile(path.join(sourceDirectory, sourceName));
    const sourceUrl = `data:image/png;base64,${source.toString('base64')}`;
    const processed = await page.evaluate(async ({ sourceUrl: url, maximumDimension, quality: outputQuality }) => {
      const image = new Image();
      image.src = url;
      await image.decode();

      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = image.naturalWidth;
      sourceCanvas.height = image.naturalHeight;
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sourceContext) throw new Error('Canvas 2D source context is unavailable.');
      sourceContext.drawImage(image, 0, 0);
      const pixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;

      let left = sourceCanvas.width;
      let top = sourceCanvas.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < sourceCanvas.height; y += 1) {
        for (let x = 0; x < sourceCanvas.width; x += 1) {
          if ((pixels[(y * sourceCanvas.width + x) * 4 + 3] ?? 0) <= 2) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      if (right < left || bottom < top) throw new Error('The source image has no visible alpha content.');

      const visibleWidth = right - left + 1;
      const visibleHeight = bottom - top + 1;
      const padding = Math.max(2, Math.ceil(Math.max(visibleWidth, visibleHeight) * 0.008));
      const cropLeft = Math.max(0, left - padding);
      const cropTop = Math.max(0, top - padding);
      const cropRight = Math.min(sourceCanvas.width - 1, right + padding);
      const cropBottom = Math.min(sourceCanvas.height - 1, bottom + padding);
      const cropWidth = cropRight - cropLeft + 1;
      const cropHeight = cropBottom - cropTop + 1;
      const scale = Math.min(1, maximumDimension / Math.max(cropWidth, cropHeight));
      const width = Math.max(1, Math.round(cropWidth * scale));
      const height = Math.max(1, Math.round(cropHeight * scale));

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const outputContext = outputCanvas.getContext('2d');
      if (!outputContext) throw new Error('Canvas 2D output context is unavailable.');
      outputContext.imageSmoothingEnabled = true;
      outputContext.imageSmoothingQuality = 'high';
      outputContext.drawImage(
        sourceCanvas,
        cropLeft,
        cropTop,
        cropWidth,
        cropHeight,
        0,
        0,
        width,
        height,
      );

      return {
        dataUrl: outputCanvas.toDataURL('image/webp', outputQuality),
        width,
        height,
        crop: [cropLeft, cropTop, cropWidth, cropHeight],
      };
    }, { sourceUrl, maximumDimension, quality });

    const encoded = processed.dataUrl.slice(processed.dataUrl.indexOf(',') + 1);
    await writeFile(path.join(outputDirectory, outputName), Buffer.from(encoded, 'base64'));
    process.stdout.write(
      `${sourceName} -> ${outputName} (${processed.width}x${processed.height}; crop ${processed.crop.join(',')})\n`,
    );
  }
} finally {
  await browser.close();
}
