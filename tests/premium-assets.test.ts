import { describe, expect, it } from 'vitest';
import { PremiumAssetStore } from '../src/game/assets/PremiumAssetStore';
import {
  PREMIUM_ART_KINDS,
  PREMIUM_ASSETS,
  PREMIUM_COMMON_KINDS,
  PREMIUM_PRESTIGE_KINDS,
  PREMIUM_RUNTIME_PATHS,
  isPremiumArtCompatible,
  premiumGameplayKind,
  targetVisualArt,
} from '../src/game/assets/premium';

class FakeImage {
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public naturalWidth = 0;
  public complete = false;
  private value = '';

  public constructor(private readonly failedPath = 'fuel-depot') {}

  public set src(path: string) {
    this.value = path;
    queueMicrotask(() => {
      this.complete = true;
      if (path.includes(this.failedPath)) {
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
  it('maps all twelve gameplay identities to local transparent runtime files', () => {
    expect(PREMIUM_ART_KINDS).toHaveLength(12);
    expect(Object.keys(PREMIUM_RUNTIME_PATHS)).toHaveLength(13);
    for (const art of PREMIUM_ART_KINDS) {
      const definition = PREMIUM_ASSETS[art];
      expect(definition.path).toMatch(/^\/assets\/premium\/.+\.webp$/);
      expect(definition.imageWidth).toBeLessThanOrEqual(definition.role === 'prestige' ? 640 : 512);
      expect(definition.imageHeight).toBeLessThanOrEqual(definition.role === 'prestige' ? 640 : 512);
      if (definition.role === 'common') {
        expect(Math.max(definition.imageWidth, definition.imageHeight)).toBeLessThanOrEqual(256);
      }
      expect(definition.fragments.length).toBeGreaterThanOrEqual(6);
      expect(isPremiumArtCompatible(premiumGameplayKind(art), art)).toBe(true);
    }
    expect(premiumGameplayKind('fuelDepot')).toBe('mine');
    expect(premiumGameplayKind('solarPowerStation')).toBe('solar');
    expect(premiumGameplayKind('alienInterceptor')).toBe('splitter');
    expect(premiumGameplayKind('hunterDrone')).toBe('swarmer');
    expect(premiumGameplayKind('antimatterReactorPod')).toBe('mine');
    expect(premiumGameplayKind('shieldedCargoDrone')).toBe('splitter');
    expect(premiumGameplayKind('luxurySpaceYacht')).toBe('yacht');
    expect(premiumGameplayKind('orbitalDatacenter')).toBe('datacenter');
    expect(premiumGameplayKind('crownDroneCarrier')).toBe('carrier');
  });

  it('retires the three common geometric bodies without changing their gameplay kinds', () => {
    expect(PREMIUM_COMMON_KINDS).toEqual([
      'hunterDrone',
      'antimatterReactorPod',
      'shieldedCargoDrone',
    ]);
    expect(targetVisualArt('swarmer')).toBe('hunterDrone');
    expect(targetVisualArt('mine')).toBe('antimatterReactorPod');
    expect(targetVisualArt('splitter')).toBe('shieldedCargoDrone');
    expect(targetVisualArt('splitterFragment')).toBe('shieldedCargoDrone');
    expect(targetVisualArt('debris')).toBeNull();
    expect(PREMIUM_PRESTIGE_KINDS).toEqual([
      'luxurySpaceYacht',
      'orbitalDatacenter',
      'crownDroneCarrier',
    ]);
  });

  it('preloads once and marks a failed image for procedural fallback', async () => {
    const store = new PremiumAssetStore(() => new FakeImage() as unknown as HTMLImageElement);
    const first = store.load();
    const second = store.load();
    expect(second).toBe(first);
    const report = await first;
    expect(report).toEqual({ loaded: 12, failed: 1, total: 13 });
    expect(store.status('fuelDepot')).toBe('failed');
    expect(store.image('fuelDepot')).toBeNull();
    expect(store.image('goldTelescope')).not.toBeNull();
  });

  it('preloads all six newly supplied runtime assets successfully', async () => {
    const store = new PremiumAssetStore(() => new FakeImage('never-fails') as unknown as HTMLImageElement);
    await expect(store.load()).resolves.toEqual({ loaded: 13, failed: 0, total: 13 });
    for (const art of [
      'hunterDrone',
      'antimatterReactorPod',
      'shieldedCargoDrone',
      'luxurySpaceYacht',
      'orbitalDatacenter',
      'crownDroneCarrier',
    ] as const) {
      expect(store.status(art)).toBe('loaded');
      expect(store.image(art)).not.toBeNull();
    }
  });
});
