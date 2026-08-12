import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/game/config';
import {
  chainMilestone,
  minePrimeDelay,
  shockwaveCanHit,
  shockwaveDamage,
  shockwaveRadius,
} from '../src/game/logic/chain';
import { coreBurstOutcome, haloTierForMass } from '../src/game/logic/halo';
import {
  createOverdriveState,
  overdriveScoreMultiplier,
  registerOverdriveDestruction,
  tickOverdrive,
} from '../src/game/logic/overdrive';

describe('orbital chain rules', () => {
  it('reports each concise chain milestone once at its threshold', () => {
    expect([4, 5, 14, 15, 29, 30, 49, 50, 51].map(chainMilestone)).toEqual([
      null,
      'CASCADE',
      null,
      'ORBITAL PANIC',
      null,
      'MASS EVENT',
      null,
      'ONE FRAME',
      null,
    ]);
  });

  it('allows one hit per wave and keeps radii and mine delays bounded', () => {
    expect(shockwaveCanHit(61, 8, 54, false)).toBe(true);
    expect(shockwaveCanHit(61, 8, 54, true)).toBe(false);
    expect(shockwaveCanHit(80, 8, 54, false)).toBe(false);
    expect(shockwaveRadius('mine', 100)).toBeLessThanOrEqual(138);
    expect(shockwaveRadius('swarmer', 0)).toBe(52);
    expect(shockwaveDamage('swarmer')).toBeLessThan(1);
    expect(shockwaveDamage('mine')).toBeGreaterThan(1);
    expect(minePrimeDelay(0)).toBe(0.16);
    expect(minePrimeDelay(100)).toBe(0.065);
  });
});

describe('halo and Core Burst rules', () => {
  it('maps compact halo tiers at the configured mass thresholds', () => {
    expect([0, 7.99, 8, 24, 54, 96, 999].map(haloTierForMass)).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });

  it('consumes mass, retains a meaningful halo, and rewards Magnetic Rim', () => {
    const base = coreBurstOutcome(20, 0);
    const upgraded = coreBurstOutcome(20, 5);

    expect(base.retainedMass).toBeCloseTo(11.2);
    expect(base.consumedMass).toBeCloseTo(8.8);
    expect(base.shardCount).toBeGreaterThanOrEqual(12);
    expect(base.shardCount).toBeLessThanOrEqual(28);
    expect(base.waveRadius).toBeGreaterThan(112);
    expect(upgraded.retainedMass).toBeGreaterThan(base.retainedMass);
    expect(upgraded.retentionRatio).toBeLessThanOrEqual(0.74);

    const fullHalo = coreBurstOutcome(TUNING.haloMassCapacity, 5);
    expect(haloTierForMass(fullHalo.retainedMass)).toBeLessThan(haloTierForMass(TUNING.haloMassCapacity));
    expect(coreBurstOutcome(999, 0).retainedMass).toBeLessThan(TUNING.haloThresholds[3] ?? 96);
  });
});

describe('Overdrive rules', () => {
  it('gains from aggressive destruction, drains while idle, and clamps score intensity', () => {
    const initial = createOverdriveState(0.2);
    const aggressive = registerOverdriveDestruction(initial, 15, true);
    const idle = tickOverdrive(aggressive, 10, false, false);

    expect(aggressive.value).toBeGreaterThan(initial.value);
    expect(idle.value).toBeLessThan(aggressive.value);
    expect(overdriveScoreMultiplier(-5)).toBe(1);
    expect(overdriveScoreMultiplier(5)).toBe(2.5);
  });

  it('uses hysteresis so a high state does not flicker at its entry threshold', () => {
    const high = createOverdriveState(0.8);
    expect(tickOverdrive(high, 1, false, false).high).toBe(true);
    expect(tickOverdrive({ value: 0.59, high: true }, 1, false, false).high).toBe(false);
  });
});
