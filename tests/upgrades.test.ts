import { describe, expect, it } from 'vitest';
import { defaultPersistedState } from '../src/game/logic/persistence';
import {
  coverIntegrityBonus,
  impactPowerMultiplier,
  launchVelocityMultiplier,
  magneticCaptureMultiplier,
  purchaseUpgrade,
  upgradePrice,
} from '../src/game/logic/upgrades';

describe('upgrade economy', () => {
  it('uses a readable increasing price curve', () => {
    expect([0, 1, 2, 3, 4].map(upgradePrice)).toEqual([180, 340, 540, 780, 1060]);
  });

  it('purchases without mutating the previous persistent state', () => {
    const original = { ...defaultPersistedState(), scrap: 294 };
    const result = purchaseUpgrade(original, 'launchPressure');

    expect(result.purchased).toBe(true);
    expect(result.state.scrap).toBe(114);
    expect(result.state.upgrades.launchPressure).toBe(1);
    expect(original.scrap).toBe(294);
    expect(original.upgrades.launchPressure).toBe(0);
  });

  it('limits a representative 294-scrap run to one new track', () => {
    const earned = { ...defaultPersistedState(), scrap: 294 };
    const first = purchaseUpgrade(earned, 'magneticRim');
    expect(first.purchased).toBe(true);
    expect(purchaseUpgrade(first.state, 'launchPressure')).toMatchObject({
      purchased: false,
      reason: 'insufficient-scrap',
    });
  });

  it('makes every purchased level mechanically noticeable', () => {
    expect(launchVelocityMultiplier(1)).toBeCloseTo(1.09);
    expect(coverIntegrityBonus(1)).toBe(18);
    expect(impactPowerMultiplier(1)).toBeCloseTo(1.18);
    expect(magneticCaptureMultiplier(1)).toBeCloseTo(1.22);
  });

  it('rejects unaffordable and maximum-level purchases', () => {
    const poor = purchaseUpgrade(defaultPersistedState(), 'magneticRim');
    expect(poor).toMatchObject({ purchased: false, reason: 'insufficient-scrap' });

    const maxed = defaultPersistedState();
    maxed.scrap = 99_999;
    maxed.upgrades.reinforcedCover = 5;
    expect(purchaseUpgrade(maxed, 'reinforcedCover')).toMatchObject({
      purchased: false,
      reason: 'max-level',
    });
  });
});
