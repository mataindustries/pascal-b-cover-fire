import { TUNING } from '../config';
import { clamp } from '../math';
import type { HaloTier } from '../types';

export const HALO_TIER_LABELS = [
  'NO HALO',
  'SCRAP RING',
  'SHRAPNEL FIELD',
  'CRITICAL MASS',
  'ORBITAL CATASTROPHE',
] as const;

export const haloTierForMass = (mass: number): HaloTier => {
  if (mass >= (TUNING.haloThresholds[3] ?? Number.POSITIVE_INFINITY)) return 4;
  if (mass >= (TUNING.haloThresholds[2] ?? Number.POSITIVE_INFINITY)) return 3;
  if (mass >= (TUNING.haloThresholds[1] ?? Number.POSITIVE_INFINITY)) return 2;
  if (mass >= (TUNING.haloThresholds[0] ?? Number.POSITIVE_INFINITY)) return 1;
  return 0;
};

export interface CoreBurstOutcome {
  retainedMass: number;
  consumedMass: number;
  retentionRatio: number;
  shardCount: number;
  waveRadius: number;
}

export const coreBurstOutcome = (mass: number, magneticLevel: number): CoreBurstOutcome => {
  const safeMass = clamp(mass, 0, TUNING.haloMassCapacity);
  const retentionRatio = clamp(
    TUNING.coreBurstBaseRetention
      + Math.max(0, Math.floor(magneticLevel)) * TUNING.coreBurstRetentionPerMagneticLevel,
    TUNING.coreBurstBaseRetention,
    0.74,
  );
  const retainedMass = safeMass * retentionRatio;
  const consumedMass = safeMass - retainedMass;
  return {
    retainedMass,
    consumedMass,
    retentionRatio,
    shardCount: clamp(Math.round(12 + consumedMass * 1.05), 12, TUNING.maxBurstShards),
    waveRadius: clamp(112 + consumedMass * 3.2, 112, 172),
  };
};
