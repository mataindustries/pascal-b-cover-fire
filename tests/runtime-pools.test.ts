import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/game/config';
import { ChainSystem } from '../src/game/systems/ChainSystem';
import { HaloSystem } from '../src/game/systems/HaloSystem';

describe('orbital runtime pools', () => {
  it('caps active halo mass and guarantees a tier drop after Core Burst', () => {
    const halo = new HaloSystem();
    halo.reset();
    expect(halo.addMass(10_000, 5)).toBe(TUNING.haloMassCapacity);
    expect(halo.mass).toBe(TUNING.haloMassCapacity);
    expect(halo.activeCount()).toBeLessThanOrEqual(TUNING.haloMaxOrbiters);
    expect(halo.tier()).toBe(4);

    halo.fillBurst();
    const outcome = halo.consumeBurst(5);
    expect(outcome).not.toBeNull();
    expect(halo.tier()).toBeLessThan(4);
    expect(halo.peakMass).toBe(TUNING.haloMassCapacity);
    expect(halo.activeCount()).toBeLessThanOrEqual(TUNING.haloMaxOrbiters);
  });

  it('bounds gameplay waves and Burst shards and fully deactivates them on reset', () => {
    const chains = new ChainSystem();
    for (let index = 0; index < TUNING.maxGameplayWaves + 3; index += 1) {
      chains.emitWave(100, 100, 80, 1, 0, 'shockwave');
    }
    expect(chains.activeWaveCount()).toBe(TUNING.maxGameplayWaves);
    expect(chains.droppedWaves).toBe(3);
    expect(chains.emitWave(100, 100, 160, 1.15, 0, 'burst')).not.toBeNull();
    expect(chains.activeWaveCount()).toBe(TUNING.maxGameplayWaves);
    expect(chains.fireBurst(225, 400, 999, 0)).toBe(TUNING.maxBurstShards);
    expect(chains.activeShardCount()).toBe(TUNING.maxBurstShards);

    chains.reset();
    expect(chains.activeWaveCount()).toBe(0);
    expect(chains.activeShardCount()).toBe(0);
    expect(chains.droppedWaves).toBe(0);
  });
});
