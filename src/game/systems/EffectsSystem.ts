import { COLORS, TUNING } from '../config';
import { clamp } from '../math';
import type { ImpactText, Particle, Shockwave } from '../types';

export class EffectsSystem {
  public readonly particles: Particle[];
  public readonly shockwaves: Shockwave[];
  public readonly texts: ImpactText[];
  public shakeStrength = 0;
  public shakeTime = 0;
  public flash = 0;
  public hitStop = 0;
  private reducedMotion = false;

  public constructor() {
    this.particles = Array.from({ length: TUNING.maxParticles }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      size: 0,
      color: COLORS.ivory,
      drag: 0,
    }));
    this.shockwaves = Array.from({ length: TUNING.maxShockwaves }, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 0,
      maxRadius: 0,
      life: 0,
      maxLife: 0,
      color: COLORS.ivory,
      width: 2,
    }));
    this.texts = Array.from({ length: TUNING.maxImpactTexts }, () => ({
      active: false,
      x: 0,
      y: 0,
      text: '',
      life: 0,
      maxLife: 0,
      color: COLORS.ivory,
      scale: 1,
    }));
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public update(delta: number): void {
    this.shakeTime = Math.max(0, this.shakeTime - delta);
    if (this.shakeTime === 0) this.shakeStrength = 0;
    this.flash = Math.max(0, this.flash - delta * 3.4);
    this.hitStop = Math.max(0, this.hitStop - delta);

    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= delta;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      const damping = Math.max(0, 1 - particle.drag * delta);
      particle.vx *= damping;
      particle.vy *= damping;
    }

    for (const wave of this.shockwaves) {
      if (!wave.active) continue;
      wave.life -= delta;
      if (wave.life <= 0) {
        wave.active = false;
        continue;
      }
      const progress = 1 - wave.life / wave.maxLife;
      wave.radius = wave.maxRadius * (1 - (1 - progress) * (1 - progress));
    }

    for (const text of this.texts) {
      if (!text.active) continue;
      text.life -= delta;
      text.y -= 24 * delta;
      if (text.life <= 0) text.active = false;
    }
  }

  public burst(
    x: number,
    y: number,
    amount: number,
    color: string,
    speed = 180,
    direction?: number,
  ): void {
    const boundedAmount = this.reducedMotion ? Math.ceil(amount * 0.38) : amount;
    for (let index = 0; index < boundedAmount; index += 1) {
      const particle = this.particles.find((candidate) => !candidate.active);
      if (!particle) break;
      const angle = direction === undefined
        ? Math.random() * Math.PI * 2
        : direction + (Math.random() - 0.5) * 1.55;
      const velocity = speed * (0.35 + Math.random() * 0.8);
      const life = 0.22 + Math.random() * 0.48;
      Object.assign(particle, {
        active: true,
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        maxLife: life,
        size: 1.2 + Math.random() * 3.8,
        color,
        drag: 0.8 + Math.random() * 1.8,
      });
    }
  }

  public ring(x: number, y: number, radius: number, color: string = COLORS.ivory, width = 2): void {
    const wave = this.shockwaves.find((candidate) => !candidate.active);
    if (!wave) return;
    const life = this.reducedMotion ? 0.32 : 0.48;
    Object.assign(wave, {
      active: true,
      x,
      y,
      radius: 0,
      maxRadius: radius,
      life,
      maxLife: life,
      color,
      width,
    });
  }

  public impact(
    x: number,
    y: number,
    tier: 1 | 2 | 3,
    color: string = COLORS.amber,
    direction?: number,
  ): void {
    this.burst(x, y, tier === 3 ? 28 : tier === 2 ? 15 : 7, color, 120 + tier * 75, direction);
    this.ring(x, y, 24 + tier * 24, tier === 3 ? COLORS.ivory : color, 1 + tier);
    this.shake(tier * 2.6, 0.08 + tier * 0.035);
    if (tier >= 2) this.hitStop = Math.max(this.hitStop, tier === 3 ? 0.075 : 0.036);
    if (tier === 3) this.flash = Math.max(this.flash, this.reducedMotion ? 0.16 : 0.34);
  }

  public label(text: string, x: number, y: number, color: string = COLORS.ivory, scale = 1): void {
    const impactText = this.texts.find((candidate) => !candidate.active)
      ?? this.texts.reduce((oldest, candidate) => candidate.life < oldest.life ? candidate : oldest);
    Object.assign(impactText, {
      active: true,
      text,
      x,
      y,
      life: 0.95,
      maxLife: 0.95,
      color,
      scale,
    });
  }

  public shake(strength: number, duration: number): void {
    if (this.reducedMotion) return;
    this.shakeStrength = clamp(Math.max(this.shakeStrength, strength), 0, 11);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  public clear(): void {
    for (const particle of this.particles) particle.active = false;
    for (const wave of this.shockwaves) wave.active = false;
    for (const text of this.texts) text.active = false;
    this.shakeStrength = 0;
    this.shakeTime = 0;
    this.flash = 0;
    this.hitStop = 0;
  }
}
