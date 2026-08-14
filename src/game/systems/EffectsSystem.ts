import { COLORS, MOTHERSHIP, TUNING } from '../config';
import { PREMIUM_ASSETS } from '../assets/premium';
import { clamp } from '../math';
import type {
  EffectLink,
  ExplosionTier,
  HullFragment,
  ImpactText,
  Particle,
  PremiumArtKind,
  PremiumDestructionCue,
  PremiumFragment,
  Shockwave,
} from '../types';

export class EffectsSystem {
  public readonly particles: Particle[];
  public readonly shockwaves: Shockwave[];
  public readonly links: EffectLink[];
  public readonly texts: ImpactText[];
  public readonly hullFragments: HullFragment[];
  public readonly premiumFragments: PremiumFragment[];
  public readonly premiumDestructionCues: PremiumDestructionCue[];
  public shakeStrength = 0;
  public shakeTime = 0;
  public flash = 0;
  public hitStop = 0;
  private reducedMotion = false;
  private quality = 1;
  private particleCursor = 0;

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
      visual: 'spark',
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
    this.links = Array.from({ length: TUNING.maxEffectLinks }, () => ({
      active: false,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
      life: 0,
      maxLife: 0,
      color: COLORS.ivory,
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
    this.hullFragments = Array.from({ length: TUNING.maxHullFragments }, () => ({
      active: false,
      x: 0,
      y: 0,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 0,
      sourceHeight: 0,
      width: 0,
      height: 0,
      vx: 0,
      vy: 0,
      rotation: 0,
      spin: 0,
      life: 0,
      maxLife: 0,
      armorSection: false,
    }));
    this.premiumFragments = Array.from({ length: TUNING.maxPremiumFragments }, () => ({
      active: false,
      art: 'communicationsSatellite',
      x: 0,
      y: 0,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 0,
      sourceHeight: 0,
      width: 0,
      height: 0,
      vx: 0,
      vy: 0,
      rotation: 0,
      spin: 0,
      life: 0,
      maxLife: 0,
      glow: 0,
      stage: 'detached',
    }));
    this.premiumDestructionCues = Array.from({ length: TUNING.maxPremiumDestructionCues }, () => ({
      active: false,
      art: 'communicationsSatellite',
      x: 0,
      y: 0,
      rotation: 0,
      inheritedVx: 0,
      inheritedVy: 0,
      seed: 0,
      delay: 0,
    }));
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public setQuality(quality: number): void {
    this.quality = clamp(quality, 0.45, 1);
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

    for (const link of this.links) {
      if (!link.active) continue;
      link.life -= delta;
      if (link.life <= 0) link.active = false;
    }

    for (const text of this.texts) {
      if (!text.active) continue;
      text.life -= delta;
      text.y -= 24 * delta;
      if (text.life <= 0) text.active = false;
    }

    for (const fragment of this.hullFragments) {
      if (!fragment.active) continue;
      fragment.life -= delta;
      if (fragment.life <= 0) {
        fragment.active = false;
        continue;
      }
      fragment.x += fragment.vx * delta;
      fragment.y += fragment.vy * delta;
      fragment.rotation += fragment.spin * delta;
      fragment.vx *= Math.pow(0.992, delta * 60);
      fragment.vy += (fragment.armorSection ? 10 : 22) * delta;
    }

    for (const fragment of this.premiumFragments) {
      if (!fragment.active) continue;
      fragment.life -= delta;
      if (fragment.life <= 0) {
        fragment.active = false;
        continue;
      }
      fragment.x += fragment.vx * delta;
      fragment.y += fragment.vy * delta;
      fragment.rotation += fragment.spin * delta;
      fragment.vx *= Math.pow(0.994, delta * 60);
      fragment.vy *= Math.pow(0.997, delta * 60);
      fragment.glow = Math.max(0, fragment.glow - delta * 1.6);
    }

    for (const cue of this.premiumDestructionCues) {
      if (!cue.active) continue;
      cue.delay -= delta;
      if (cue.delay <= 0) {
        cue.active = false;
        this.spawnPremiumCoreFragments(cue);
      }
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
    const motionScale = this.reducedMotion ? 0.38 : 1;
    const boundedAmount = Math.max(1, Math.ceil(amount * motionScale * this.quality));
    for (let index = 0; index < boundedAmount; index += 1) {
      const particle = this.nextInactiveParticle();
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
        visual: 'spark',
      });
    }
  }

  public smoke(x: number, y: number, amount = 1): void {
    const boundedAmount = Math.max(1, Math.ceil(amount * (this.reducedMotion ? 0.5 : 1) * this.quality));
    for (let index = 0; index < boundedAmount; index += 1) {
      const particle = this.nextInactiveParticle();
      if (!particle) return;
      const life = 0.55 + Math.random() * 0.5;
      Object.assign(particle, {
        active: true,
        x: x + (Math.random() - 0.5) * 13,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 28,
        vy: -18 - Math.random() * 34,
        life,
        maxLife: life,
        size: 3.5 + Math.random() * 4.5,
        color: Math.random() > 0.35 ? '#46515A' : '#252C32',
        drag: 0.45 + Math.random() * 0.45,
        visual: 'wisp',
      });
    }
  }

  public plasmaWisp(x: number, y: number, amount: number, color: string = COLORS.blue): void {
    const boundedAmount = Math.max(1, Math.ceil(amount * (this.reducedMotion ? 0.5 : 1) * this.quality));
    for (let index = 0; index < boundedAmount; index += 1) {
      const particle = this.nextInactiveParticle();
      if (!particle) return;
      const angle = Math.random() * Math.PI * 2;
      const speed = 22 + Math.random() * 52;
      const life = 0.48 + Math.random() * 0.46;
      Object.assign(particle, {
        active: true,
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 12,
        life,
        maxLife: life,
        size: 3 + Math.random() * 4.5,
        color,
        drag: 0.7 + Math.random() * 0.7,
        visual: 'wisp',
      });
    }
  }

  public premiumImpact(x: number, y: number, art: PremiumArtKind, direction?: number): void {
    const palette = PREMIUM_ASSETS[art].palette;
    this.burst(x, y, 4, palette[0], 165, direction);
    this.burst(x, y, 3, palette[1], 118, direction);
    this.ring(x, y, art === 'solarPowerStation' ? 42 : 32, palette[2], 1.4);
  }

  public premiumDestruction(
    art: PremiumArtKind,
    x: number,
    y: number,
    rotation: number,
    inheritedVx: number,
    inheritedVy: number,
    seed: number,
  ): void {
    const definition = PREMIUM_ASSETS[art];
    const detached = definition.fragments.filter((fragment) => fragment.stage === 'detached');
    const immediateCount = art === 'solarPowerStation' ? Math.min(6, detached.length) : detached.length;
    for (let index = 0; index < immediateCount; index += 1) {
      const fragment = detached[index];
      if (!fragment) continue;
      this.spawnPremiumFragment(art, fragment, x, y, rotation, inheritedVx, inheritedVy, seed + index * 17, index);
    }
    if (art === 'solarPowerStation' || art === 'alienInterceptor') {
      const cue = this.premiumDestructionCues.find((candidate) => !candidate.active)
        ?? this.premiumDestructionCues.reduce((oldest, candidate) => candidate.delay < oldest.delay ? candidate : oldest);
      Object.assign(cue, {
        active: true,
        art,
        x,
        y,
        rotation,
        inheritedVx,
        inheritedVy,
        seed,
        delay: art === 'solarPowerStation' ? 0.16 : 0.12,
      });
    } else {
      this.spawnPremiumCoreFragments({
        active: true,
        art,
        x,
        y,
        rotation,
        inheritedVx,
        inheritedVy,
        seed,
        delay: 0,
      });
    }
    const palette = definition.palette;
    this.burst(x, y, art === 'fuelDepot' ? 26 : 15, palette[0], art === 'fuelDepot' ? 355 : 245);
    this.burst(x, y, 10, palette[1], 190);
    this.smoke(x, y, art === 'fuelDepot' || art === 'solarPowerStation' ? 5 : 3);
    this.plasmaWisp(
      x,
      y,
      art === 'alienInterceptor' || art === 'observationModule' ? 5 : 3,
      art === 'fuelDepot' ? '#FF8B24' : palette[2],
    );
    if (art === 'fuelDepot') {
      this.ring(x, y, 154, '#FFF8E8', 4.8);
      this.ring(x, y, 119, '#FF8B24', 3.2);
    } else {
      this.ring(x, y, art === 'solarPowerStation' ? 104 : 72, palette[2], 2.4);
    }
  }

  public activePremiumFragmentCount(): number {
    return this.premiumFragments.reduce((count, fragment) => count + (fragment.active ? 1 : 0), 0);
  }

  public bossBreachFragments(reactorIndex: number, x: number, y: number, inheritedVx: number): void {
    const core = MOTHERSHIP.coreAnchors[reactorIndex];
    if (!core) return;
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2 + reactorIndex * 0.17;
      const sourceWidth = 62 + (index % 3) * 12;
      const sourceHeight = 50 + ((index + 1) % 3) * 10;
      const sourceX = clamp(core.x + Math.cos(angle) * 86 - sourceWidth / 2, 0, MOTHERSHIP.sourceWidth - sourceWidth);
      const sourceY = clamp(core.y + Math.sin(angle) * 78 - sourceHeight / 2, 0, MOTHERSHIP.sourceHeight - sourceHeight);
      const scale = MOTHERSHIP.renderWidth / MOTHERSHIP.sourceWidth;
      this.spawnHullFragment({
        x: x + Math.cos(angle) * 26,
        y: y + Math.sin(angle) * 23,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        width: sourceWidth * scale,
        height: sourceHeight * scale,
        vx: inheritedVx * 0.6 + Math.cos(angle) * (72 + index * 9),
        vy: Math.sin(angle) * (65 + index * 8) - 12,
        rotation: angle,
        spin: (index % 2 === 0 ? 1 : -1) * (1.7 + index * 0.32),
        life: 2.1 + (index % 3) * 0.24,
        armorSection: false,
      });
    }
  }

  public separateBossSections(x: number, y: number, inheritedVx: number): void {
    const sections = [
      { sourceX: 0, sourceY: 360, sourceWidth: 410, sourceHeight: 700, x: -132, y: 35, vx: -92, vy: 28, spin: -0.42 },
      { sourceX: 820, sourceY: 360, sourceWidth: 410, sourceHeight: 700, x: 132, y: 35, vx: 92, vy: 28, spin: 0.42 },
      { sourceX: 430, sourceY: 0, sourceWidth: 370, sourceHeight: 500, x: 0, y: -122, vx: 0, vy: -74, spin: 0.24 },
      { sourceX: 455, sourceY: 650, sourceWidth: 320, sourceHeight: 628, x: 0, y: 126, vx: 8, vy: 94, spin: -0.28 },
    ] as const;
    const scale = MOTHERSHIP.renderWidth / MOTHERSHIP.sourceWidth;
    for (const section of sections) {
      this.spawnHullFragment({
        ...section,
        x: x + section.x,
        y: y + section.y,
        width: section.sourceWidth * scale,
        height: section.sourceHeight * scale,
        vx: inheritedVx + section.vx,
        rotation: 0,
        life: 3.1,
        armorSection: true,
      });
    }
  }

  public activeHullFragmentCount(): number {
    return this.hullFragments.reduce((count, fragment) => count + (fragment.active ? 1 : 0), 0);
  }

  public link(fromX: number, fromY: number, toX: number, toY: number, color: string = COLORS.amber): void {
    const link = this.links.find((candidate) => !candidate.active);
    if (!link) return;
    const life = this.reducedMotion ? 0.09 : 0.16;
    Object.assign(link, { active: true, fromX, fromY, toX, toY, life, maxLife: life, color });
  }

  public explosion(
    x: number,
    y: number,
    tier: ExplosionTier,
    color: string = COLORS.amber,
    direction?: number,
  ): void {
    const settings = tier === 'catastrophe'
      ? { particles: 42, speed: 430, radius: 154, width: 4, shake: 10, stop: 0.075 }
      : tier === 'cascade'
        ? { particles: 26, speed: 340, radius: 108, width: 3, shake: 6.5, stop: 0 }
        : tier === 'burst'
          ? { particles: 15, speed: 245, radius: 68, width: 2.4, shake: 3.5, stop: 0 }
          : { particles: 7, speed: 175, radius: 38, width: 1.5, shake: 1.3, stop: 0 };
    this.burst(x, y, settings.particles, color, settings.speed, direction);
    this.ring(x, y, settings.radius, tier === 'catastrophe' ? COLORS.ivory : color, settings.width);
    this.shake(settings.shake, tier === 'catastrophe' ? 0.36 : tier === 'cascade' ? 0.18 : 0.08);
    if (settings.stop > 0) this.hitStop = Math.max(this.hitStop, settings.stop);
    if (tier === 'catastrophe') this.flash = Math.max(this.flash, this.reducedMotion ? 0.12 : 0.28);
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

  public launch(x: number, y: number, charge: number): void {
    const strength = clamp(charge, 0, 1);
    this.ring(x, y + 9, 118 + strength * 82, COLORS.ivory, 3 + strength * 2);
    this.ring(x, y + 18, 68 + strength * 58, COLORS.amber, 2);
    this.burst(x, y + 20, 18 + Math.round(strength * 18), COLORS.amber, 260 + strength * 170, Math.PI / 2);
    this.burst(x, y + 26, 14 + Math.round(strength * 12), '#8C7657', 150 + strength * 110, Math.PI / 2);
    this.burst(x, y + 12, 8 + Math.round(strength * 8), COLORS.ivory, 370 + strength * 140, Math.PI / 2);
  }

  public capture(fromX: number, fromY: number, toX: number, toY: number, mass: number): void {
    const direction = Math.atan2(toY - fromY, toX - fromX);
    const amount = clamp(Math.round(4 + mass * 1.6), 4, 11);
    this.burst(fromX, fromY, amount, COLORS.blue, 150 + mass * 18, direction);
    this.ring(toX, toY, 34 + Math.min(24, mass * 4), COLORS.blue, 1.5);
  }

  public haloThreshold(x: number, y: number, tier: number): void {
    const radius = 62 + tier * 19;
    const color = tier >= 3 ? COLORS.lime : tier === 2 ? COLORS.amber : COLORS.blue;
    this.ring(x, y, radius, color, 2 + tier * 0.55);
    this.ring(x, y, radius * 0.68, COLORS.ivory, 1.5);
    this.shake(2.5 + tier * 1.2, 0.16 + tier * 0.035);
    this.hitStop = Math.max(this.hitStop, 0.025 + tier * 0.012);
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
    for (const link of this.links) link.active = false;
    for (const text of this.texts) text.active = false;
    for (const fragment of this.hullFragments) fragment.active = false;
    for (const fragment of this.premiumFragments) fragment.active = false;
    for (const cue of this.premiumDestructionCues) cue.active = false;
    this.shakeStrength = 0;
    this.shakeTime = 0;
    this.flash = 0;
    this.hitStop = 0;
    this.particleCursor = 0;
  }

  public clearLabels(): void {
    for (const text of this.texts) text.active = false;
  }

  private nextInactiveParticle(): Particle | null {
    for (let offset = 0; offset < this.particles.length; offset += 1) {
      const index = (this.particleCursor + offset) % this.particles.length;
      const particle = this.particles[index];
      if (!particle?.active) {
        this.particleCursor = (index + 1) % this.particles.length;
        return particle ?? null;
      }
    }
    return null;
  }

  private spawnHullFragment(fragment: Omit<HullFragment, 'active' | 'maxLife'>): void {
    const pooled = this.hullFragments.find((candidate) => !candidate.active)
      ?? this.hullFragments.reduce((oldest, candidate) => candidate.life < oldest.life ? candidate : oldest);
    Object.assign(pooled, fragment, { active: true, maxLife: fragment.life });
  }

  private spawnPremiumCoreFragments(cue: PremiumDestructionCue): void {
    const definition = PREMIUM_ASSETS[cue.art];
    const core = definition.fragments.filter((fragment) => fragment.stage === 'core');
    for (let index = 0; index < core.length; index += 1) {
      const fragment = core[index];
      if (!fragment) continue;
      this.spawnPremiumFragment(
        cue.art,
        fragment,
        cue.x,
        cue.y,
        cue.rotation,
        cue.inheritedVx,
        cue.inheritedVy,
        cue.seed + 97 + index * 23,
        index + 6,
      );
    }
    if (cue.art === 'solarPowerStation') {
      this.explosion(cue.x, cue.y, 'cascade', '#FF9C32');
    } else if (cue.art === 'alienInterceptor') {
      this.explosion(cue.x, cue.y, 'burst', '#FF6A22');
      this.burst(cue.x, cue.y, 12, '#2CBAFF', 270);
    }
  }

  private spawnPremiumFragment(
    art: PremiumArtKind,
    fragment: (typeof PREMIUM_ASSETS)[PremiumArtKind]['fragments'][number],
    x: number,
    y: number,
    rotation: number,
    inheritedVx: number,
    inheritedVy: number,
    seed: number,
    index: number,
  ): void {
    const definition = PREMIUM_ASSETS[art];
    const sourceX = Math.round(fragment.x * definition.imageWidth);
    const sourceY = Math.round(fragment.y * definition.imageHeight);
    const sourceWidth = Math.max(1, Math.round(fragment.width * definition.imageWidth));
    const sourceHeight = Math.max(1, Math.round(fragment.height * definition.imageHeight));
    const scale = definition.renderWidth / definition.imageWidth;
    const localX = (fragment.x + fragment.width * 0.5 - 0.5) * definition.renderWidth;
    const renderHeight = definition.imageHeight * scale;
    const localY = (fragment.y + fragment.height * 0.5 - 0.5) * renderHeight;
    const rotatedX = Math.cos(rotation) * localX - Math.sin(rotation) * localY;
    const rotatedY = Math.sin(rotation) * localX + Math.cos(rotation) * localY;
    const angle = index / Math.max(4, definition.fragments.length) * Math.PI * 2 + seed * 0.019;
    const speed = fragment.stage === 'core' ? 92 + (seed % 31) : 128 + (seed % 57);
    const life = fragment.stage === 'core' ? 1.6 + (seed % 5) * 0.12 : 2.05 + (seed % 7) * 0.11;
    const pooled = this.premiumFragments.find((candidate) => !candidate.active)
      ?? this.premiumFragments.reduce((oldest, candidate) => candidate.life < oldest.life ? candidate : oldest);
    Object.assign(pooled, {
      active: true,
      art,
      x: x + rotatedX * 0.58,
      y: y + rotatedY * 0.58,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      width: Math.max(8, sourceWidth * scale * 0.86),
      height: Math.max(8, sourceHeight * scale * 0.86),
      vx: inheritedVx * 0.34 + Math.cos(angle) * speed,
      vy: inheritedVy * 0.34 + Math.sin(angle) * speed,
      rotation: rotation + angle * 0.22,
      spin: (index % 2 === 0 ? 1 : -1) * (1.1 + (seed % 9) * 0.17),
      life,
      maxLife: life,
      glow: 1,
      stage: fragment.stage,
    });
  }
}
