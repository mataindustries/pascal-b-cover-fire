import { COLORS, TUNING } from '../config';
import { clamp } from '../math';
import type { HaloOrbiter } from '../types';

export class HaloSystem {
  public readonly orbiters: HaloOrbiter[];
  public mass = 0;
  public radius = 36;
  public pulse = 0;

  public constructor() {
    this.orbiters = Array.from({ length: TUNING.haloMaxOrbiters }, () => ({
      active: false,
      angle: 0,
      angularVelocity: 0,
      distanceFactor: 0,
      size: 0,
      shape: 0,
      brightness: 0,
    }));
  }

  public reset(): void {
    this.mass = 0;
    this.radius = 36;
    this.pulse = 0;
    for (const orbiter of this.orbiters) orbiter.active = false;
  }

  public addMass(amount: number, captureMultiplier: number): void {
    const captured = Math.max(0, amount) * captureMultiplier;
    this.mass += captured;
    this.radius = clamp(36 + Math.sqrt(this.mass) * 10.5, 36, TUNING.haloMaxRadius);
    this.pulse = 1;

    const visualCount = Math.max(1, Math.round(captured * 0.85));
    for (let index = 0; index < visualCount; index += 1) {
      const orbiter = this.orbiters.find((candidate) => !candidate.active)
        ?? this.orbiters[Math.floor(Math.random() * this.orbiters.length)];
      if (!orbiter) continue;
      Object.assign(orbiter, {
        active: true,
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (0.78 + Math.random() * 1.15) * (Math.random() > 0.22 ? 1 : -0.62),
        distanceFactor: 0.48 + Math.random() * 0.52,
        size: 2.5 + Math.random() * Math.min(8, 3 + captured),
        shape: Math.floor(Math.random() * 4),
        brightness: 0.35 + Math.random() * 0.65,
      });
    }
  }

  public update(delta: number, velocity: number): void {
    this.pulse = Math.max(0, this.pulse - delta * 2.3);
    const velocityFactor = 0.8 + Math.min(velocity / 500, 1) * 0.55;
    for (const orbiter of this.orbiters) {
      if (!orbiter.active) continue;
      orbiter.angle += orbiter.angularVelocity * velocityFactor * delta;
    }
  }

  public activeCount(): number {
    return this.orbiters.reduce((count, orbiter) => count + (orbiter.active ? 1 : 0), 0);
  }

  public colorForMass(): string {
    if (this.mass >= 38) return COLORS.lime;
    if (this.mass >= 18) return COLORS.amber;
    return COLORS.blue;
  }
}
