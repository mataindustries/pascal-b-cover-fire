import { COLORS, STAGE, TUNING } from '../config';
import { clamp, seededNoise, smoothstep } from '../math';
import type { BossState, GamePhase, PlayerState, WorldTarget } from '../types';
import type { ComboState } from '../logic/combo';
import type { EffectsSystem } from '../systems/EffectsSystem';
import type { HaloSystem } from '../systems/HaloSystem';
import type { WorldSystem } from '../systems/WorldSystem';

export interface RenderState {
  phase: GamePhase;
  phaseTime: number;
  elapsed: number;
  aim: number;
  charge: number;
  charging: boolean;
  ascentProgress: number;
  backgroundScroll: number;
  player: PlayerState;
  world: WorldSystem;
  halo: HaloSystem;
  effects: EffectsSystem;
  boss: BossState;
  combo: ComboState;
  score: number;
  reducedMotion: boolean;
  debugEnabled: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly stars: Star[];
  private pixelRatio = 1;
  private logicalHeight: number = STAGE.height;
  private verticalOffset = 0;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is not supported by this browser.');
    this.context = context;
    this.stars = Array.from({ length: 82 }, (_, index) => ({
      x: seededNoise(index * 4 + 1) * STAGE.width,
      y: seededNoise(index * 4 + 2) * STAGE.height,
      size: 0.45 + seededNoise(index * 4 + 3) * 1.6,
      alpha: 0.24 + seededNoise(index * 4 + 4) * 0.7,
    }));
    this.resize();
  }

  public resize(): void {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = this.canvas.getBoundingClientRect();
    const aspectHeight = bounds.width > 0
      ? STAGE.width * bounds.height / bounds.width
      : STAGE.height;
    this.logicalHeight = clamp(aspectHeight, STAGE.height, 1_000);
    this.verticalOffset = (this.logicalHeight - STAGE.height) * 0.5;
    this.canvas.width = Math.round(STAGE.width * this.pixelRatio);
    this.canvas.height = Math.round(this.logicalHeight * this.pixelRatio);
  }

  public render(state: RenderState): void {
    const ctx = this.context;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.fillStyle = COLORS.space;
    ctx.fillRect(0, 0, STAGE.width, this.logicalHeight);

    const shake = state.effects.shakeTime > 0 && !state.reducedMotion ? state.effects.shakeStrength : 0;
    const shakeX = shake ? (Math.random() - 0.5) * shake * 2 : 0;
    const shakeY = shake ? (Math.random() - 0.5) * shake * 2 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY + this.verticalOffset);

    this.drawBackground(state);
    if (state.phase === 'launch') this.drawLaunchSite(state);
    if (state.phase === 'ascent') this.drawAscentDetails(state);
    if (state.phase === 'orbit' || state.phase === 'boss') {
      this.drawGravityWells(state);
      this.drawPredictedTrajectory(state);
    }
    if (state.phase === 'ascent' || state.phase === 'orbit' || state.phase === 'boss') {
      this.drawSpeedLines(state);
      for (const target of state.world.targets) if (target.active) this.drawTarget(target);
    }
    if (state.phase === 'boss') this.drawBoss(state.boss, state.phaseTime);
    if (state.phase === 'ascent' || state.phase === 'orbit' || state.phase === 'boss' || state.phase === 'launch') {
      this.drawHalo(state);
      this.drawCover(state);
    }
    this.drawEffects(state.effects);
    if (state.debugEnabled) this.drawDebugBounds(state);
    this.drawPhaseInstrumentation(state);
    ctx.restore();

    if (state.effects.flash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(state.effects.flash, 0, state.reducedMotion ? 0.18 : 0.72);
      ctx.fillStyle = COLORS.ivory;
      ctx.fillRect(0, 0, STAGE.width, this.logicalHeight);
      ctx.restore();
    }
  }

  private drawBackground(state: RenderState): void {
    const ctx = this.context;
    if (state.phase === 'boot' || state.phase === 'title' || state.phase === 'hint' || state.phase === 'results') {
      ctx.fillStyle = COLORS.space;
      ctx.fillRect(0, 0, STAGE.width, STAGE.height);
      this.drawStars(state.backgroundScroll * 0.04, 0.32);
      return;
    }

    if (state.phase === 'launch') {
      const gradient = ctx.createLinearGradient(0, 0, 0, STAGE.height);
      gradient.addColorStop(0, '#16212A');
      gradient.addColorStop(0.45, '#A26228');
      gradient.addColorStop(0.7, '#34271C');
      gradient.addColorStop(1, '#080A0C');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, STAGE.width, STAGE.height);
      return;
    }

    if (state.phase === 'ascent') {
      const progress = state.ascentProgress;
      const gradient = ctx.createLinearGradient(0, 0, 0, STAGE.height);
      if (progress < 0.4) {
        gradient.addColorStop(0, '#183B55');
        gradient.addColorStop(0.48, '#5F94AC');
        gradient.addColorStop(1, '#BD6B31');
      } else if (progress < 0.77) {
        gradient.addColorStop(0, '#080E1A');
        gradient.addColorStop(0.55, '#173B58');
        gradient.addColorStop(1, '#527D91');
      } else {
        gradient.addColorStop(0, COLORS.space);
        gradient.addColorStop(0.65, '#0B1726');
        gradient.addColorStop(1, '#1A4661');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, STAGE.width, STAGE.height);
      this.drawStars(state.backgroundScroll * 0.15, smoothstep(0.55, 0.85, progress));
      return;
    }

    ctx.fillStyle = COLORS.space;
    ctx.fillRect(0, 0, STAGE.width, STAGE.height);
    this.drawStars(state.backgroundScroll, 1);
    const limb = ctx.createRadialGradient(225, 970, 230, 225, 970, 610);
    limb.addColorStop(0, '#2F7187');
    limb.addColorStop(0.28, '#143849');
    limb.addColorStop(0.33, '#44C7F466');
    limb.addColorStop(0.35, '#06080D00');
    ctx.fillStyle = limb;
    ctx.fillRect(0, 560, STAGE.width, 240);
  }

  private drawStars(scroll: number, alpha: number): void {
    const ctx = this.context;
    ctx.save();
    for (const star of this.stars) {
      const y = (star.y + scroll * (0.08 + star.size * 0.12)) % STAGE.height;
      ctx.globalAlpha = star.alpha * alpha;
      ctx.fillStyle = star.size > 1.55 ? COLORS.blue : COLORS.ivory;
      ctx.fillRect(star.x, y, star.size, star.size);
    }
    ctx.restore();
  }

  private drawLaunchSite(state: RenderState): void {
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = '#16191B';
    ctx.beginPath();
    ctx.moveTo(0, 338);
    ctx.lineTo(84, 316);
    ctx.lineTo(155, 330);
    ctx.lineTo(242, 299);
    ctx.lineTo(325, 327);
    ctx.lineTo(450, 292);
    ctx.lineTo(450, 800);
    ctx.lineTo(0, 800);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#25201A';
    ctx.fillRect(0, 360, STAGE.width, 440);

    ctx.fillStyle = '#080A0C';
    ctx.fillRect(181, 470, 88, 330);
    ctx.fillStyle = '#33373A';
    ctx.fillRect(174, 466, 8, 334);
    ctx.fillRect(269, 466, 8, 334);
    ctx.strokeStyle = '#5B4D36';
    ctx.lineWidth = 1;
    for (let y = 490; y < 800; y += 24) {
      ctx.beginPath();
      ctx.moveTo(182, y);
      ctx.lineTo(268, y + 6);
      ctx.stroke();
    }

    ctx.fillStyle = '#111416';
    ctx.fillRect(39, 378, 108, 66);
    ctx.fillStyle = COLORS.coral;
    const warningPulse = 0.55 + Math.sin(state.elapsed * (state.charging ? 16 : 5)) * 0.35;
    ctx.globalAlpha = warningPulse;
    ctx.fillRect(52, 392, 10, 10);
    ctx.fillRect(123, 392, 10, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '700 10px "Arial Narrow", sans-serif';
    ctx.fillText('SHAFT PRESSURE', 52, 424);

    ctx.strokeStyle = COLORS.ivory;
    ctx.globalAlpha = 0.16;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(225, 466);
    const launchAngle = -Math.PI / 2 + state.aim;
    for (let index = 1; index <= 20; index += 1) {
      const distance = index * 14;
      const bend = index * index * 0.13;
      ctx.lineTo(
        225 + Math.cos(launchAngle) * distance,
        466 + Math.sin(launchAngle) * distance + bend * 0.05,
      );
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const chargeHeight = 190;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.ivory;
    ctx.lineWidth = 1;
    ctx.strokeRect(397, 478, 13, chargeHeight);
    ctx.fillStyle = state.charge > 0.82 ? COLORS.coral : COLORS.amber;
    ctx.fillRect(400, 665 - chargeHeight * state.charge, 7, chargeHeight * state.charge);
    ctx.save();
    ctx.translate(386, 663);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '700 9px monospace';
    ctx.fillText('PRESSURE', 0, 0);
    ctx.restore();
    ctx.restore();
  }

  private drawAscentDetails(state: RenderState): void {
    const ctx = this.context;
    const progress = state.ascentProgress;
    ctx.save();
    if (progress < 0.55) {
      for (let index = 0; index < 8; index += 1) {
        const y = ((index * 137 + state.backgroundScroll * 0.58) % 950) - 90;
        const x = seededNoise(index + 45) * STAGE.width;
        const width = 74 + seededNoise(index + 80) * 105;
        ctx.globalAlpha = (1 - progress) * 0.17;
        ctx.fillStyle = COLORS.ivory;
        ctx.beginPath();
        ctx.ellipse(x, y, width, 18 + width * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '10px monospace';
    ctx.fillText(`${Math.round(progress * 100)} KM`, 18, 750);
    ctx.fillRect(18, 758, 82 * progress, 2);
    ctx.restore();
  }

  private drawGravityWells(state: RenderState): void {
    const ctx = this.context;
    for (const well of state.world.gravityWells) {
      ctx.save();
      ctx.translate(well.x, well.y);
      ctx.rotate(well.phase * 0.18);
      const gradient = ctx.createRadialGradient(0, 0, 4, 0, 0, well.radius);
      gradient.addColorStop(0, '#06080D');
      gradient.addColorStop(0.12, '#06080D');
      gradient.addColorStop(0.2, '#44C7F433');
      gradient.addColorStop(0.62, '#44C7F40D');
      gradient.addColorStop(1, '#44C7F400');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, well.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.blue;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 11]);
      ctx.beginPath();
      ctx.ellipse(0, 0, well.radius * 0.64, well.radius * 0.25, 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPredictedTrajectory(state: RenderState): void {
    const speed = Math.hypot(state.player.vx, state.player.vy);
    if (speed < 20) return;
    const ctx = this.context;
    let x = state.player.x;
    let y = state.player.y;
    let vx = state.player.vx;
    let vy = state.player.vy;
    ctx.save();
    ctx.strokeStyle = COLORS.ivory;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let index = 0; index < 24; index += 1) {
      for (const well of state.world.gravityWells) {
        const dx = well.x - x;
        const dy = well.y - y;
        const distanceSquared = Math.max(1500, dx * dx + dy * dy);
        const gravity = well.strength / distanceSquared;
        vx += dx * gravity * 0.075;
        vy += dy * gravity * 0.075;
      }
      x += vx * 0.055;
      y += vy * 0.055;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawSpeedLines(state: RenderState): void {
    const ctx = this.context;
    const speed = Math.hypot(state.player.vx, state.player.vy);
    const intensity = clamp(speed / 560, 0.1, 1);
    const angle = Math.atan2(state.player.vy, state.player.vx);
    ctx.save();
    ctx.strokeStyle = state.phase === 'ascent' ? COLORS.ivory : COLORS.blue;
    ctx.globalAlpha = 0.1 + intensity * 0.2;
    ctx.lineWidth = 1;
    const count = state.reducedMotion ? 8 : 18;
    for (let index = 0; index < count; index += 1) {
      const seed = index + Math.floor(state.backgroundScroll * 0.02);
      const x = seededNoise(seed * 3 + 1) * STAGE.width;
      const y = (seededNoise(seed * 3 + 2) * STAGE.height + state.backgroundScroll * 0.7) % STAGE.height;
      const length = 18 + seededNoise(seed * 3 + 3) * 52 * intensity;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(angle) * length, y - Math.sin(angle) * length);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTarget(target: WorldTarget): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(target.rotation);
    const damaged = target.hp < target.maxHp;
    ctx.strokeStyle = damaged ? COLORS.coral : COLORS.steel;
    ctx.fillStyle = target.kind === 'drone' ? '#263B48' : COLORS.gunmetal;
    ctx.lineWidth = 2;

    switch (target.kind) {
      case 'balloon':
        ctx.fillStyle = '#D1C4A8';
        ctx.beginPath();
        ctx.ellipse(0, -4, 16, 21, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 17);
        ctx.lineTo(0, 31);
        ctx.stroke();
        ctx.fillRect(-4, 29, 8, 6);
        break;
      case 'aircraft':
        ctx.fillStyle = '#12171C';
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.lineTo(4, -5);
        ctx.lineTo(-10, -19);
        ctx.lineTo(-15, -17);
        ctx.lineTo(-8, -3);
        ctx.lineTo(-28, 3);
        ctx.lineTo(-5, 7);
        ctx.lineTo(-12, 17);
        ctx.lineTo(-7, 18);
        ctx.lineTo(5, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'instrument':
        ctx.fillRect(-8, -10, 16, 20);
        ctx.strokeRect(-8, -10, 16, 20);
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, -22);
        ctx.arc(0, -23, 5, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'satellite':
      case 'solar': {
        const panelWidth = target.kind === 'solar' ? 25 : 18;
        ctx.fillStyle = '#17475E';
        ctx.fillRect(-panelWidth - 10, -8, panelWidth, 16);
        ctx.fillRect(10, -8, panelWidth, 16);
        ctx.strokeRect(-panelWidth - 10, -8, panelWidth, 16);
        ctx.strokeRect(10, -8, panelWidth, 16);
        ctx.strokeStyle = COLORS.blue;
        for (let x = -panelWidth - 5; x < -10; x += 7) {
          ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x, 8); ctx.stroke();
        }
        ctx.fillStyle = COLORS.steel;
        ctx.fillRect(-9, -12, 18, 24);
        ctx.strokeStyle = damaged ? COLORS.coral : COLORS.ivory;
        ctx.strokeRect(-9, -12, 18, 24);
        break;
      }
      case 'tank':
        ctx.fillStyle = '#394047';
        ctx.fillRect(-18, -13, 36, 26);
        ctx.strokeRect(-18, -13, 36, 26);
        ctx.fillStyle = '#151A1E';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(29, 0); ctx.stroke();
        break;
      case 'antenna':
        ctx.beginPath();
        ctx.arc(0, 0, 15, -0.65, 0.65);
        ctx.lineTo(-4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-18, 0); ctx.stroke();
        break;
      case 'asteroid':
        ctx.fillStyle = '#35383A';
        ctx.beginPath();
        for (let index = 0; index < 9; index += 1) {
          const angle = index / 9 * Math.PI * 2;
          const radius = target.radius * (0.72 + seededNoise(target.id * 12 + index) * 0.34);
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#15191C';
        ctx.beginPath(); ctx.arc(-5, -6, 4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'drone':
        ctx.fillStyle = '#1C3440';
        ctx.beginPath();
        ctx.moveTo(18, 0); ctx.lineTo(5, -10); ctx.lineTo(-13, -8); ctx.lineTo(-18, 0);
        ctx.lineTo(-13, 8); ctx.lineTo(5, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = COLORS.coral;
        ctx.fillRect(2, -2, 8, 4);
        break;
      case 'debris':
        ctx.fillStyle = COLORS.steel;
        ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(4, -8); ctx.lineTo(9, 5); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill();
        break;
    }
    ctx.restore();
  }

  private drawBoss(boss: BossState, phaseTime: number): void {
    if (!boss.active && !boss.destroyed) return;
    const ctx = this.context;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    const entranceScale = 0.82 + boss.entrance * 0.18;
    ctx.scale(entranceScale, entranceScale);
    ctx.globalAlpha = boss.destroyed ? clamp(1 - (phaseTime - (TUNING.bossDuration - boss.timeRemaining)) * 0.3, 0, 1) : 1;

    ctx.shadowColor = COLORS.coral;
    ctx.shadowBlur = boss.flash > 0 ? 22 : 0;
    ctx.fillStyle = boss.flash > 0 ? COLORS.ivory : '#151C23';
    ctx.strokeStyle = COLORS.steel;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-138, 5);
    ctx.lineTo(-102, -25);
    ctx.lineTo(-64, -37);
    ctx.lineTo(-38, -64);
    ctx.lineTo(0, -78);
    ctx.lineTo(38, -64);
    ctx.lineTo(64, -37);
    ctx.lineTo(102, -25);
    ctx.lineTo(138, 5);
    ctx.lineTo(94, 34);
    ctx.lineTo(49, 39);
    ctx.lineTo(24, 61);
    ctx.lineTo(-24, 61);
    ctx.lineTo(-49, 39);
    ctx.lineTo(-94, 34);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#44515C';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-94, 5); ctx.lineTo(94, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-42, -48); ctx.lineTo(-19, 30); ctx.lineTo(19, 30); ctx.lineTo(42, -48); ctx.stroke();

    const weakpoints = [-72, 0, 72];
    const remainingRatio = boss.hp / boss.maxHp;
    weakpoints.forEach((offset, index) => {
      const alive = remainingRatio > index / weakpoints.length;
      ctx.fillStyle = alive ? COLORS.coral : '#12161A';
      ctx.globalAlpha = alive ? 0.72 + Math.sin(phaseTime * 7 + index) * 0.2 : 0.45;
      ctx.beginPath(); ctx.arc(offset, index === 1 ? -12 : 8, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = alive ? COLORS.ivory : COLORS.gunmetal; ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '700 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UNKNOWN ORBITAL PLATFORM', 0, -94);
    ctx.restore();
  }

  private drawHalo(state: RenderState): void {
    if (state.halo.mass <= 0.05) return;
    const ctx = this.context;
    const color = state.halo.colorForMass();
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.1 + Math.min(state.halo.mass / 60, 0.25) + state.halo.pulse * 0.18;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, state.halo.radius, state.halo.radius * 0.7, state.player.rotation * 0.08, 0, Math.PI * 2);
    ctx.stroke();

    for (const orbiter of state.halo.orbiters) {
      if (!orbiter.active) continue;
      const distance = state.halo.radius * orbiter.distanceFactor;
      const x = Math.cos(orbiter.angle) * distance;
      const y = Math.sin(orbiter.angle) * distance * 0.7;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(orbiter.angle * 2.4);
      ctx.globalAlpha = 0.48 + orbiter.brightness * 0.48;
      ctx.fillStyle = orbiter.brightness > 0.78 ? COLORS.ivory : COLORS.steel;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.8;
      if (orbiter.shape === 0) {
        ctx.fillRect(-orbiter.size, -orbiter.size * 0.22, orbiter.size * 2, orbiter.size * 0.44);
      } else if (orbiter.shape === 1) {
        ctx.beginPath(); ctx.arc(0, 0, orbiter.size * 0.58, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-orbiter.size, -orbiter.size * 0.35);
        ctx.lineTo(orbiter.size * 0.65, -orbiter.size * 0.55);
        ctx.lineTo(orbiter.size, orbiter.size * 0.44);
        ctx.lineTo(-orbiter.size * 0.5, orbiter.size * 0.62);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawCover(state: RenderState): void {
    const ctx = this.context;
    const player = state.player;
    const speed = Math.hypot(player.vx, player.vy);
    const tremble = state.phase === 'launch' && state.charging && !state.reducedMotion
      ? state.charge * 2.8
      : 0;
    const x = player.x + (Math.random() - 0.5) * tremble;
    const y = player.y + (Math.random() - 0.5) * tremble;
    const angle = speed > 5 ? Math.atan2(player.vy, player.vx) : -Math.PI / 2 + state.aim;

    if (speed > 40) {
      const trailLength = clamp(speed * 0.22, 26, 118);
      const gradient = ctx.createLinearGradient(
        x,
        y,
        x - Math.cos(angle) * trailLength,
        y - Math.sin(angle) * trailLength,
      );
      gradient.addColorStop(0, state.phase === 'ascent' ? COLORS.coral : COLORS.blue);
      gradient.addColorStop(1, '#44C7F400');
      ctx.save();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(angle) * trailLength, y - Math.sin(angle) * trailLength); ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(player.rotation);
    const hot = state.phase === 'ascent' ? state.player.heat : 0;
    ctx.shadowColor = hot > 0.25 ? COLORS.coral : COLORS.blue;
    ctx.shadowBlur = 8 + hot * 13;
    ctx.fillStyle = COLORS.gunmetal;
    ctx.strokeStyle = hot > 0.58 ? COLORS.coral : COLORS.ivory;
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.steel;
    ctx.beginPath(); ctx.arc(0, 0, player.radius * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#313943';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, player.radius * 0.45, 0, Math.PI * 2); ctx.stroke();
    for (let index = 0; index < 6; index += 1) {
      const radial = index / 6 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(radial) * 5, Math.sin(radial) * 5);
      ctx.lineTo(Math.cos(radial) * player.radius * 0.67, Math.sin(radial) * player.radius * 0.67);
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.ivory;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(-5, -7, 5, 2.2, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private drawEffects(effects: EffectsSystem): void {
    const ctx = this.context;
    ctx.save();
    for (const particle of effects.particles) {
      if (!particle.active) continue;
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size * 0.5, particle.y - particle.size * 0.5, particle.size, particle.size);
    }
    for (const wave of effects.shockwaves) {
      if (!wave.active) continue;
      ctx.globalAlpha = clamp(wave.life / wave.maxLife, 0, 1) * 0.75;
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = wave.width;
      ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.textAlign = 'center';
    for (const text of effects.texts) {
      if (!text.active) continue;
      const progress = text.life / text.maxLife;
      ctx.globalAlpha = clamp(progress * 1.8, 0, 1);
      ctx.fillStyle = text.color;
      ctx.font = `900 ${Math.round(15 * text.scale)}px "Arial Narrow", sans-serif`;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.restore();
  }

  private drawPhaseInstrumentation(state: RenderState): void {
    const ctx = this.context;
    ctx.save();
    ctx.font = '700 9px monospace';
    ctx.fillStyle = COLORS.ivory;
    ctx.globalAlpha = 0.36;
    if (state.phase === 'launch') {
      ctx.fillText(`VECTOR ${(state.aim * 57.2958).toFixed(1)}°`, 18, 466);
      ctx.fillText(state.charging ? 'HOLD // BUILDING PRESSURE' : 'DRAG TO AIM · HOLD · RELEASE', 18, 486);
    } else if (state.phase === 'orbit' || state.phase === 'boss') {
      ctx.fillText(`MASS CAPTURE ${Math.round(state.halo.mass * 1000)} KG`, 16, 781);
      if (state.combo.count >= 4) {
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = state.combo.count >= 9 ? COLORS.lime : COLORS.amber;
        ctx.font = '900 13px "Arial Narrow", sans-serif';
        ctx.fillText(state.combo.count >= 9 ? 'ORBITAL CASCADE' : `CHAIN x${state.combo.count}`, STAGE.width / 2, 135);
      }
    }
    ctx.restore();
  }

  private drawDebugBounds(state: RenderState): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = COLORS.lime;
    ctx.fillStyle = COLORS.lime;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
    ctx.stroke();
    if (state.halo.mass > 0) {
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, state.halo.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const target of state.world.targets) {
      if (!target.active) continue;
      ctx.beginPath(); ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2); ctx.stroke();
    }
    for (const well of state.world.gravityWells) {
      ctx.beginPath(); ctx.arc(well.x, well.y, well.radius, 0, Math.PI * 2); ctx.stroke();
    }
    if (state.phase === 'boss' && state.boss.active) {
      ctx.save();
      ctx.translate(state.boss.x, state.boss.y);
      ctx.scale(1, 72 / 142);
      ctx.beginPath(); ctx.arc(0, 0, 142, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(state.player.x + state.player.vx * 0.18, state.player.y + state.player.vy * 0.18);
    ctx.stroke();
    ctx.restore();
  }
}
