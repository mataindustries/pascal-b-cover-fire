import { describe, expect, it } from 'vitest';
import { calculateScrap, completionBonus, impactScore } from '../src/game/logic/scoring';

describe('score calculation', () => {
  it('combines base value, combo, and bounded halo mass', () => {
    expect(impactScore(1_000, 3, 25)).toBe(1_800);
    expect(impactScore(1_000, 1, 500)).toBe(1_640);
    expect(impactScore(-50, 4, 10)).toBe(0);
  });

  it('awards completion and integrity bonuses only for victory', () => {
    expect(completionBonus(false, 100)).toBe(0);
    expect(completionBonus(true, 50)).toBe(5_900);
  });

  it('always returns enough baseline scrap for forward progress', () => {
    expect(calculateScrap(0, 0, false)).toBe(12);
    expect(calculateScrap(13_000, 30, true)).toBe(72);
  });
});
