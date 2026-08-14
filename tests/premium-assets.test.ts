import { describe, expect, it } from 'vitest';
import { PremiumAssetStore } from '../src/game/assets/PremiumAssetStore';
import {
  PREMIUM_ART_KINDS,
  PREMIUM_ASSETS,
  PREMIUM_RUNTIME_PATHS,
  isPremiumArtCompatible,
  premiumGameplayKind,
} from '../src/game/assets/premium';

class FakeImage {
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public naturalWidth = 0;
  public complete = false;
  private value = '';

  public set src(path: string) {
    this.value = path;
    queueMicrotask(() => {
      this.complete = true;
      if (path.includes('fuel-depot')) {
        this.onerror?.();
      } else {
        this.naturalWidth = 512;
        this.onload?.();
      }
    });
  }

  public get src(): string {
    return this.value;
  }
}

describe('premium target assets', () => {
  it('maps all six gameplay identities to local transparent runtime files', () => {
    expect(PREMIUM_ART_KINDS).toHaveLength(6);
    expect(Object.keys(PREMIUM_RUNTIME_PATHS)).toHaveLength(7);
    for (const art of PREMIUM_ART_KINDS) {
      const definition = PREMIUM_ASSETS[art];
      expect(definition.path).toMatch(/^\/assets\/premium\/.+\.webp$/);
      expect(definition.imageWidth).toBeLessThanOrEqual(512);
      expect(definition.imageHeight).toBeLessThanOrEqual(512);
      expect(definition.fragments.length).toBeGreaterThanOrEqual(6);
      expect(isPremiumArtCompatible(premiumGameplayKind(art), art)).toBe(true);
    }
    expect(premiumGameplayKind('fuelDepot')).toBe('mine');
    expect(premiumGameplayKind('solarPowerStation')).toBe('solar');
    expect(premiumGameplayKind('alienInterceptor')).toBe('splitter');
  });

  it('preloads once and marks a failed image for procedural fallback', async () => {
    const store = new PremiumAssetStore(() => new FakeImage() as unknown as HTMLImageElement);
    const first = store.load();
    const second = store.load();
    expect(second).toBe(first);
    const report = await first;
    expect(report).toEqual({ loaded: 6, failed: 1, total: 7 });
    expect(store.status('fuelDepot')).toBe('failed');
    expect(store.image('fuelDepot')).toBeNull();
    expect(store.image('goldTelescope')).not.toBeNull();
  });
});
