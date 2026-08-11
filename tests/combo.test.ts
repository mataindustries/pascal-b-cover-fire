import { describe, expect, it } from 'vitest';
import {
  comboMultiplier,
  createComboState,
  registerComboHit,
  tickCombo,
} from '../src/game/logic/combo';

describe('combo behavior', () => {
  it('chains hits inside the timer and records the largest chain', () => {
    let combo = createComboState();
    combo = registerComboHit(combo, 2.35);
    combo = tickCombo(combo, 1);
    combo = registerComboHit(combo, 2.35);
    combo = registerComboHit(combo, 2.35);

    expect(combo).toMatchObject({ count: 3, timer: 2.35, largest: 3 });
    expect(comboMultiplier(combo.count)).toBe(1.5);
  });

  it('expires the active count while retaining the run record', () => {
    let combo = registerComboHit(createComboState(), 2);
    combo = registerComboHit(combo, 2);
    combo = tickCombo(combo, 2.1);

    expect(combo).toEqual({ count: 0, timer: 0, largest: 2 });
    expect(registerComboHit(combo, 2).count).toBe(1);
  });

  it('caps multiplier growth', () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(100)).toBe(4);
  });
});
