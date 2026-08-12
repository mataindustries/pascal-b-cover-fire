import { COLORS, TUNING } from '../config';
import { coreBurstOutcome, haloTierForMass, type CoreBurstOutcome } from '../logic/halo';
import { clamp, seededNoise } from '../math';
import type { HaloOrbiter, HaloTier } from '../types';

export class HaloSystem {
  public readonly orbiters: HaloOrbiter[];
  public mass = 0;
  public peakMass = 0;
  public radius = 34;
  public pulse = 0;
  public burstCharge = 0;
  private orbiterCursor = 0;
  private visualSeed = 1;

  public constructor() {
    this.orbiters = Array.from({ length: TUNING.haloMaxOrbiters }, (_, index) => ({
      active: false,
      angle: index / TUNING.haloMaxOrbiters * Math.PI * 2,
      angularVelocity: 0,
      distanceFactor: 0,
      size: 0,
      shape: 0,
      brightness: 0,
      band: index % 3,
    }));
  }

  public reset(startingBurstCharge = 0): void {
    this.mass = 0;
    this.peakMass = 0;
    this.radius = 34;
    this.pulse = 0;
    this.burstCharge = clamp(startingBurstCharge, 0, 1);
    this.orbiterCursor = 0;
    this.visualSeed += 101;
    for (const orbiter of this.orbiters) orbiter.active = false;
  }

  public addMass(amount: number, captureMultiplier: number): number {
    const captured = Math.max(0, amount) * captureMultiplier;
    const before = this.mass;
    this.mass = clamp(this.mass + captured, 0, TUNING.haloMassCapacity);
    this.peakMass = Math.max(this.peakMass, this.mass);
    this.recalculateRadius();
    this.pulse = 1;

    const added = this.mass - before;
    if (added <= 0) return 0;
    const visualCount = Math.max(1, Math.round(added * 1.15));
    for (let index = 0; index < visualCount; index += 1) {
      const orbiter = this.nextOrbiter();
      const seed = this.visualSeed + this.orbiterCursor * 7 + index * 13;
      const band = this.orbiterCursor % 3;
      Object.assign(orbiter, {
        active: true,
        angle: seededNoise(seed) * Math.PI * 2,
        angularVelocity: (1.18 + seededNoise(seed + 1) * 1.15) * (band === 1 ? -0.82 : 1),
        distanceFactor: [0.53, 0.73, 0.94][band] ?? 0.73,
        size: 2.8 + seededNoise(seed + 2) * Math.min(6.5, 2.5 + added),
        shape: Math.floor(seededNoise(seed + 3) * 4),
        brightness: 0.48 + seededNoise(seed + 4) * 0.52,
        band,
      });
    }
    return added;
  }

  public addBurstCharge(amount: number): void {
    this.burstCharge = clamp(this.burstCharge + Math.max(0, amount), 0, 1);
  }

  public fillBurst(): void {
    this.burstCharge = 1;
    if (this.mass < TUNING.coreBurstMinimumMass) this.addMass(TUNING.coreBurstMinimumMass - this.mass, 1);
  }

  public canBurst(): boolean {
    return this.burstCharge >= 1 && this.mass >= TUNING.coreBurstMinimumMass;
  }

  public consumeBurst(magneticLevel: number): CoreBurstOutcome | null {
    if (!this.canBurst()) return null;
    const outcome = coreBurstOutcome(this.mass, magneticLevel);
    this.mass = outcome.retainedMass;
    this.burstCharge = 0;
    this.recalculateRadius();
    this.pulse = 1;

    const targetActive = Math.max(2, Math.round(this.activeCount() * outcome.retentionRatio));
    let retained = 0;
    for (const orbiter of this.orbiters) {
      if (!orbiter.active) continue;
      retained += 1;
      if (retained > targetActive) orbiter.active = false;
    }
    return outcome;
  }

  public update(delta: number, velocity: number): void {
    this.pulse = Math.max(0, this.pulse - delta * 2.8);
    const velocityFactor = 0.92 + Math.min(velocity / 500, 1) * 0.58;
    for (const orbiter of this.orbiters) {
      if (!orbiter.active) continue;
      orbiter.angle += orbiter.angularVelocity * velocityFactor * delta;
    }
  }

  public activeCount(): number {
    return this.orbiters.reduce((count, orbiter) => count + (orbiter.active ? 1 : 0), 0);
  }

  public tier(): HaloTier {
    return haloTierForMass(this.mass);
  }

  public contactDamage(): number {
    const tier = this.tier();
    if (tier === 0) return 0;
    return [0, 0.6, 1, 1.35, 1.7][tier] ?? 0;
  }

  public colorForMass(): string {
    const tier = this.tier();
    if (tier >= 4) return COLORS.lime;
    if (tier >= 3) return COLORS.coral;
    if (tier >= 2) return COLORS.amber;
    return COLORS.blue;
  }

  private recalculateRadius(): void {
    this.radius = clamp(34 + Math.sqrt(this.mass) * 3.7, 34, TUNING.haloMaxRadius);
  }

  private nextOrbiter(): HaloOrbiter {
    const inactive = this.orbiters.find((candidate) => !candidate.active);
    const orbiter = inactive ?? this.orbiters[this.orbiterCursor % this.orbiters.length];
    this.orbiterCursor = (this.orbiterCursor + 1) % this.orbiters.length;
    return orbiter ?? this.orbiters[0]!;
  }
}
