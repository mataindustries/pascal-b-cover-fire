import { clamp } from '../math';
import type { TargetKind } from '../types';

export type ChainMilestone = 'CASCADE' | 'ORBITAL PANIC' | 'MASS EVENT' | 'ONE FRAME';

export const chainMilestone = (count: number): ChainMilestone | null => {
  if (count === 5) return 'CASCADE';
  if (count === 15) return 'ORBITAL PANIC';
  if (count === 30) return 'MASS EVENT';
  if (count === 50) return 'ONE FRAME';
  return null;
};

export const shockwaveCanHit = (
  distance: number,
  targetRadius: number,
  waveRadius: number,
  alreadyHit: boolean,
): boolean => !alreadyHit && distance <= waveRadius + Math.max(0, targetRadius);

export const shockwaveRadius = (kind: TargetKind, chainCount: number): number => {
  const base = kind === 'mine'
    ? 104
    : kind === 'splitter'
      ? 76
      : kind === 'swarmer' || kind === 'splitterFragment'
        ? 52
        : 64;
  return Math.round(base * (1 + clamp(chainCount, 0, 40) * 0.008));
};

/**
 * Small targets need overlapping waves or a deliberate cover hit to continue a
 * chain. Mines and Core Burst remain the reliable single-wave chain starters.
 */
export const shockwaveDamage = (kind: TargetKind): number => {
  if (kind === 'mine') return 1.25;
  if (kind === 'splitter') return 1;
  if (kind === 'swarmer' || kind === 'splitterFragment') return 0.62;
  return 0.82;
};

export const minePrimeDelay = (chainDepth: number): number =>
  clamp(0.16 - Math.max(0, chainDepth) * 0.008, 0.065, 0.16);
