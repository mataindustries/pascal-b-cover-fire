import { describe, expect, it } from 'vitest';
import { PREMIUM_AMBIENT_KINDS, PREMIUM_PRESTIGE_KINDS } from '../src/game/assets/premium';
import { PremiumShuffleBag } from '../src/game/logic/premiumRoster';

const draw = (seed: number, count: number): string[] => {
  const bag = new PremiumShuffleBag(PREMIUM_AMBIENT_KINDS, seed);
  return Array.from({ length: count }, () => bag.draw());
};

describe('deterministic premium shuffle bags', () => {
  it('shows every entry before repeating and reproduces a seeded order', () => {
    const first = draw(57, PREMIUM_AMBIENT_KINDS.length * 2);
    const second = draw(57, PREMIUM_AMBIENT_KINDS.length * 2);
    expect(first).toEqual(second);
    expect(new Set(first.slice(0, PREMIUM_AMBIENT_KINDS.length)).size).toBe(PREMIUM_AMBIENT_KINDS.length);
    expect(new Set(first.slice(PREMIUM_AMBIENT_KINDS.length)).size).toBe(PREMIUM_AMBIENT_KINDS.length);
    for (let index = 1; index < first.length; index += 1) expect(first[index]).not.toBe(first[index - 1]);
  });

  it('varies the order between seeds while keeping prestige entries unique per cycle', () => {
    expect(draw(11, 6)).not.toEqual(draw(12, 6));
    const prestige = new PremiumShuffleBag(PREMIUM_PRESTIGE_KINDS, 901);
    const cycle = PREMIUM_PRESTIGE_KINDS.map(() => prestige.draw());
    expect(new Set(cycle).size).toBe(3);
  });
});
