import { describe, expect, it } from 'vitest';
import { defaultPersistedState } from '../src/game/logic/persistence';
import { purchaseUpgrade, upgradePrice } from '../src/game/logic/upgrades';

describe('upgrade economy', () => {
  it('uses a readable increasing price curve', () => {
    expect([0, 1, 2, 3].map(upgradePrice)).toEqual([40, 87, 159, 257]);
  });

  it('purchases without mutating the previous persistent state', () => {
    const original = { ...defaultPersistedState(), scrap: 100 };
    const result = purchaseUpgrade(original, 'launchPressure');

    expect(result.purchased).toBe(true);
    expect(result.state.scrap).toBe(60);
    expect(result.state.upgrades.launchPressure).toBe(1);
    expect(original.scrap).toBe(100);
    expect(original.upgrades.launchPressure).toBe(0);
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
