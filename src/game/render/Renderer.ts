import { COLORS, MOTHERSHIP, STAGE, TUNING } from '../config';
import {
  PREMIUM_ASSETS,
  premiumFallbackColor,
  targetVisualArt,
  type PremiumAssetKey,
} from '../assets/premium';
import type { PremiumAssetStore } from '../assets/PremiumAssetStore';
import { clamp, seededNoise, smoothstep } from '../math';
import type { BossState, GamePhase, PlayerState, PremiumArtKind, Vec2, WorldTarget } from '../types';
import type { ComboState } from '../logic/combo';
import type { OverdriveState } from '../logic/overdrive';
import type { ChainSystem } from '../systems/ChainSystem';
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
  steering: Vec2;
  ascentProgress: number;
  backgroundScroll: number;
  player: PlayerState;
  world: WorldSystem;
  halo: HaloSystem;
  chains: ChainSystem;
  effects: EffectsSystem;
  boss: BossState;
  combo: ComboState;
  overdrive: OverdriveState;
  score: number;
  reducedMotion: boolean;
  cosmeticQuality: number;
  debugEnabled: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

const normalizeVector = (x: number, y: number): Vec2 => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly stars: Star[];
  private pixelRatio = 1;
  private logicalHeight: number = STAGE.height;
  private verticalOffset = 0;
  private renderQuality = 1;

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly premiumAssets: PremiumAssetStore,
  ) {
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
    const nextWidth = Math.round(STAGE.width * this.pixelRatio);
    const nextHeight = Math.round(this.logicalHeight * this.pixelRatio);
    if (this.canvas.width !== nextWidth) this.canvas.width = nextWidth;
    if (this.canvas.height !== nextHeight) this.canvas.height = nextHeight;
  }

  public render(state: RenderState): void {
    this.renderQuality = state.cosmeticQuality;
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
    if (state.phase === 'orbit' || state.phase === 'boss') this.drawScreenEdgeResponse(state);
    if (state.phase === 'launch') this.drawLaunchSite(state);
    if (state.phase === 'ascent') {
      this.drawLaunchAfterglow(state);
      this.drawAscentDetails(state);
      this.drawSteeringFeedback(state);
    }
    if (state.phase === 'orbit' || state.phase === 'boss') {
      this.drawGravityWells(state);
      this.drawPredictedTrajectory(state);
      this.drawSteeringFeedback(state);
    }
    if (state.phase === 'ascent' || state.phase === 'orbit' || state.phase === 'boss') {
      this.drawSpeedLines(state);
      for (const target of state.world.targets) {
        if (!target.active) continue;
        if (target.telegraph > 0) this.drawPortalTelegraph(target, state.phaseTime);
        else {
          this.drawTarget(target);
          if (state.world.galleryMode && target.premiumArt) this.drawPremiumGalleryLabel(target);
        }
      }
    }
    if (state.phase === 'boss') this.drawBoss(state.boss, state.phaseTime, state.effects);
    this.drawGameplayPropagation(state);
    this.drawPremiumFragments(state.effects);
    this.drawEffects(state.effects);
    if (state.phase === 'ascent' || state.phase === 'orbit' || state.phase === 'boss' || state.phase === 'launch') {
      this.drawHalo(state);
      this.drawCover(state);
    }
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
    this.drawArenaGrid(state);
    const limb = ctx.createRadialGradient(225, 970, 230, 225, 970, 610);
    limb.addColorStop(0, '#2F7187');
    limb.addColorStop(0.28, '#143849');
    limb.addColorStop(0.33, '#44C7F466');
    limb.addColorStop(0.35, '#06080D00');
    ctx.fillStyle = limb;
    ctx.fillRect(0, 560, STAGE.width, 240);
  }

  private drawScreenEdgeResponse(state: RenderState): void {
    const ctx = this.context;
    const speed = Math.hypot(state.player.vx, state.player.vy);
    const intensity = clamp((speed - 260) / 340 + state.overdrive.value * 0.46, 0, 0.9);
    if (intensity <= 0.03) return;
    const edge = ctx.createLinearGradient(0, 0, STAGE.width, 0);
    edge.addColorStop(0, `rgba(68, 199, 244, ${intensity * 0.22})`);
    edge.addColorStop(0.11, 'rgba(68, 199, 244, 0)');
    edge.addColorStop(0.89, 'rgba(255, 78, 61, 0)');
    edge.addColorStop(1, `rgba(255, 78, 61, ${intensity * 0.18})`);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = edge;
    ctx.fillRect(0, STAGE.hudTop, STAGE.width, STAGE.height - STAGE.hudTop);
    ctx.restore();
  }

  private drawArenaGrid(state: RenderState): void {
    const ctx = this.context;
    const pulse = state.overdrive.value * (0.55 + Math.sin(state.elapsed * 4.2) * 0.18);
    ctx.save();
    ctx.strokeStyle = state.overdrive.high ? COLORS.coral : COLORS.blue;
    ctx.globalAlpha = 0.035 + pulse * 0.055;
    ctx.lineWidth = 1;
    const spacing = 52;
    const scrollY = state.backgroundScroll * 0.22 % spacing;
    for (let x = -spacing; x <= STAGE.width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(state.elapsed + x * 0.01) * pulse * 8, STAGE.hudTop);
      ctx.lineTo(x - 36 + Math.sin(state.elapsed * 1.4 + x * 0.012) * pulse * 12, STAGE.height);
      ctx.stroke();
    }
    for (let y = STAGE.hudTop - spacing + scrollY; y < STAGE.height + spacing; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(state.elapsed * 1.3 + y * 0.02) * pulse * 7);
      ctx.lineTo(STAGE.width, y - 24 + Math.sin(state.elapsed + y * 0.018) * pulse * 9);
      ctx.stroke();
    }
    ctx.restore();
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

    const shaftGlow = ctx.createLinearGradient(0, 790, 0, 468);
    shaftGlow.addColorStop(0, state.charge > 0.75 ? '#FFF4D6' : COLORS.amber);
    shaftGlow.addColorStop(0.38, state.charge > 0.52 ? '#FF6A32' : '#6A321C');
    shaftGlow.addColorStop(1, '#080A0C');
    ctx.globalAlpha = 0.18 + state.charge * 0.72;
    ctx.fillStyle = shaftGlow;
    ctx.fillRect(181, 470, 88, 330);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#080A0C';
    ctx.globalAlpha = 1 - state.charge * 0.3;
    ctx.fillRect(189, 470, 72, 330);
    ctx.globalAlpha = 1;
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
    const warningPulse = 0.55 + Math.sin(state.elapsed * (state.charging ? 16 + state.charge * 15 : 5)) * 0.35;
    ctx.globalAlpha = warningPulse;
    ctx.fillRect(52, 392, 10, 10);
    ctx.fillRect(123, 392, 10, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '700 10px "Arial Narrow", sans-serif';
    ctx.fillText('SHAFT PRESSURE', 52, 424);

    ctx.strokeStyle = COLORS.steel;
    ctx.fillStyle = '#0A0E11';
    ctx.fillRect(303, 374, 96, 74);
    ctx.strokeRect(303, 374, 96, 74);
    for (let index = 0; index < 5; index += 1) {
      const activity = clamp(state.charge * 5 - index, 0, 1);
      ctx.fillStyle = activity > 0.7 ? (index >= 3 ? COLORS.coral : COLORS.amber) : '#293138';
      ctx.fillRect(315 + index * 15, 388, 8, 8);
      ctx.fillStyle = COLORS.blue;
      ctx.globalAlpha = 0.18 + activity * 0.72;
      ctx.fillRect(315 + index * 15, 409, 8, 22 * activity);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '700 8px monospace';
    ctx.fillText('AUTH // 57-B', 313, 440);

    const strain = state.charging ? state.charge : 0;
    ctx.strokeStyle = strain > 0.78 ? COLORS.coral : COLORS.steel;
    ctx.globalAlpha = 0.3 + strain * 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(164 - strain * 4, 462);
    ctx.lineTo(194, 477 + Math.sin(state.phaseTime * 26) * strain * 3);
    ctx.moveTo(286 + strain * 4, 462);
    ctx.lineTo(256, 477 - Math.sin(state.phaseTime * 24) * strain * 3);
    ctx.stroke();
    ctx.globalAlpha = 1;

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

  private drawLaunchAfterglow(state: RenderState): void {
    if (state.phaseTime > TUNING.launchAfterglowSeconds) return;
    const ctx = this.context;
    const life = 1 - state.phaseTime / TUNING.launchAfterglowSeconds;
    const strength = (0.55 + state.charge * 0.45) * life;
    ctx.save();
    const plume = ctx.createRadialGradient(state.player.x, 820, 8, state.player.x, 780, 250);
    plume.addColorStop(0, '#FFFFFF');
    plume.addColorStop(0.16, '#FFE3A1');
    plume.addColorStop(0.46, '#FF6A3255');
    plume.addColorStop(1, '#FFB00000');
    ctx.globalAlpha = strength;
    ctx.fillStyle = plume;
    ctx.fillRect(0, 500, STAGE.width, 300);
    ctx.strokeStyle = COLORS.ivory;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(state.player.x, 785, 75 + state.phaseTime * 260, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.restore();
  }

  private drawAscentDetails(state: RenderState): void {
    const ctx = this.context;
    const progress = state.ascentProgress;
    ctx.save();
    const hazeLayers = [
      { count: 7, scroll: 0.31, scale: 1.45, alpha: 0.08 },
      { count: 8, scroll: 0.58, scale: 1, alpha: 0.13 },
      { count: 6, scroll: 0.92, scale: 0.62, alpha: 0.17 },
    ];
    hazeLayers.forEach((layer, layerIndex) => {
      if (progress > 0.78 - layerIndex * 0.08) return;
      for (let index = 0; index < layer.count; index += 1) {
        const seed = index + layerIndex * 31;
        const y = ((seed * 137 + state.backgroundScroll * layer.scroll) % 980) - 100;
        const x = seededNoise(seed + 45) * STAGE.width;
        const width = (62 + seededNoise(seed + 80) * 112) * layer.scale;
        ctx.globalAlpha = (1 - progress) * layer.alpha;
        ctx.fillStyle = layerIndex === 0 ? '#B9D2D8' : COLORS.ivory;
        ctx.beginPath();
        ctx.ellipse(x, y, width, 12 + width * 0.1, layerIndex === 2 ? -0.08 : 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const milestones = [
      { at: 0.08, label: 'TROPOSPHERE // 12 KM' },
      { at: 0.32, label: 'STRATOSPHERE // 32 KM' },
      { at: 0.58, label: 'MESOSPHERE // 58 KM' },
      { at: 0.8, label: 'EXOSPHERE // 80 KM' },
    ];
    for (const milestone of milestones) {
      const proximity = 1 - Math.min(1, Math.abs(progress - milestone.at) / 0.09);
      if (proximity <= 0) continue;
      ctx.globalAlpha = 0.2 + proximity * 0.58;
      ctx.strokeStyle = COLORS.ivory;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(16, 690); ctx.lineTo(142, 690); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '700 9px monospace';
      ctx.fillStyle = COLORS.ivory;
      ctx.fillText(milestone.label, 18, 682);
    }

    if (progress > 0.68) {
      const edge = smoothstep(0.68, 1, progress);
      ctx.globalAlpha = edge * 0.35;
      ctx.strokeStyle = COLORS.blue;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(STAGE.width / 2, 930, 410, Math.PI * 1.16, Math.PI * 1.84); ctx.stroke();
    }

    ctx.globalAlpha = 0.46;
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '10px monospace';
    ctx.fillText(`${Math.round(progress * 100)} KM // ALTITUDE`, 18, 750);
    ctx.fillRect(18, 758, 82 * progress, 2);
    ctx.restore();
  }

  private drawSteeringFeedback(state: RenderState): void {
    const strength = Math.hypot(state.steering.x, state.steering.y);
    if (strength < 0.08) return;
    const ctx = this.context;
    const direction = normalizeVector(state.steering.x, state.steering.y);
    const velocity = normalizeVector(state.player.vx, state.player.vy);
    ctx.save();
    ctx.strokeStyle = state.phase === 'ascent' ? COLORS.amber : COLORS.blue;
    ctx.globalAlpha = 0.22 + strength * 0.34;
    ctx.lineWidth = 1.5 + strength;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(state.player.x - velocity.x * 22, state.player.y - velocity.y * 22);
    ctx.quadraticCurveTo(
      state.player.x + (velocity.x + direction.x) * 38,
      state.player.y + (velocity.y + direction.y) * 38,
      state.player.x + direction.x * (72 + strength * 28),
      state.player.y + direction.y * (72 + strength * 28),
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = '700 8px monospace';
    ctx.textAlign = direction.x > 0 ? 'left' : 'right';
    ctx.fillText(
      'VECTOR BEND',
      state.player.x + direction.x * (80 + strength * 28),
      state.player.y + direction.y * (80 + strength * 28),
    );
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
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 11]);
      ctx.beginPath();
      ctx.ellipse(0, 0, well.radius * 0.64, well.radius * 0.25, 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([2, 7]);
      ctx.globalAlpha = 0.13;
      ctx.beginPath(); ctx.arc(0, 0, well.radius * 0.78, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, well.radius * 0.44, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.48;
      ctx.fillStyle = COLORS.blue;
      ctx.font = '700 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GRAVITY SHEAR', 0, well.radius * 0.62);
      ctx.restore();

      const distance = Math.hypot(well.x - state.player.x, well.y - state.player.y);
      if (distance < well.radius * 1.45) {
        ctx.save();
        ctx.strokeStyle = COLORS.blue;
        ctx.globalAlpha = 0.12 + (1 - distance / (well.radius * 1.45)) * 0.38;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(state.player.x, state.player.y);
        ctx.quadraticCurveTo((state.player.x + well.x) / 2 + 18, (state.player.y + well.y) / 2 - 12, well.x, well.y);
        ctx.stroke();
        ctx.restore();
      }
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
    ctx.globalAlpha = 0.06 + intensity * (state.phase === 'ascent' ? 0.3 : 0.2);
    const count = state.reducedMotion
      ? 7
      : Math.round((10 + intensity * 14 + state.overdrive.value * 8) * state.cosmeticQuality);
    for (let index = 0; index < count; index += 1) {
      const seed = index + Math.floor(state.backgroundScroll * 0.02);
      const x = seededNoise(seed * 3 + 1) * STAGE.width;
      const y = (seededNoise(seed * 3 + 2) * STAGE.height + state.backgroundScroll * 0.7) % STAGE.height;
      const length = 12 + seededNoise(seed * 3 + 3) * (42 + intensity * 58) * intensity;
      ctx.lineWidth = 0.7 + seededNoise(seed * 3 + 5) * 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(angle) * length, y - Math.sin(angle) * length);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPortalTelegraph(target: WorldTarget, phaseTime: number): void {
    const ctx = this.context;
    const x = clamp(target.x, 16, STAGE.width - 16);
    const y = clamp(target.y, STAGE.hudTop + 16, STAGE.height - 16);
    const pulse = 0.55 + Math.sin(phaseTime * 18 + target.id) * 0.3;
    const color = target.kind === 'mine' ? COLORS.amber : target.kind === 'splitter' ? COLORS.blue : COLORS.coral;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(target.rotation);
    ctx.strokeStyle = color;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(0, 0, 17 + pulse * 8, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    for (let index = 0; index < 4; index += 1) {
      const angle = index / 4 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 25, Math.sin(angle) * 25);
      ctx.lineTo(Math.cos(angle) * 34, Math.sin(angle) * 34);
      ctx.stroke();
    }
    if (target.kind === 'carrier' || target.kind === 'datacenter' || target.kind === 'yacht') {
      ctx.rotate(-target.rotation);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.82;
      ctx.font = '800 8px monospace';
      ctx.textAlign = 'center';
      const label = target.kind === 'carrier'
        ? 'CARRIER INCURSION'
        : target.kind === 'datacenter' ? 'DATAVAULT CONTACT' : 'PRESTIGE CONTACT';
      ctx.fillText(label, 0, 45);
    }
    ctx.restore();
  }

  private drawTarget(target: WorldTarget): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(target.rotation);
    const visualArt = targetVisualArt(target.kind, target.premiumArt);
    if (visualArt) {
      this.drawPremiumTarget(target, visualArt);
      ctx.restore();
      return;
    }
    const damaged = target.hp < target.maxHp;
    const enemy = target.kind === 'swarmer' || target.kind === 'mine'
      || target.kind === 'splitter' || target.kind === 'splitterFragment';
    ctx.shadowColor = damaged || enemy ? COLORS.coral : COLORS.blue;
    ctx.shadowBlur = this.renderQuality < 0.8 ? 0 : damaged ? 8 : enemy ? 5 : 2;
    ctx.strokeStyle = damaged ? COLORS.coral : COLORS.ivory;
    ctx.fillStyle = enemy ? '#26313A' : COLORS.gunmetal;
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
        ctx.fillStyle = COLORS.amber;
        ctx.fillRect(-2, -18, 4, 6);
        break;
      }
      case 'swarmer':
        ctx.fillStyle = '#2B171A';
        ctx.beginPath();
        ctx.moveTo(13, 0); ctx.lineTo(-9, -9); ctx.lineTo(-5, 0); ctx.lineTo(-9, 9); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = COLORS.coral; ctx.beginPath(); ctx.arc(2, 0, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'mine': {
        const pulse = 0.72 + Math.sin(target.age * (target.primed ? 28 : 6) + target.behaviorPhase) * 0.22;
        ctx.strokeStyle = target.primed ? COLORS.ivory : COLORS.coral;
        ctx.fillStyle = target.primed ? '#632016' : '#30161A';
        ctx.lineWidth = target.primed ? 3 : 2;
        ctx.beginPath();
        for (let index = 0; index < 8; index += 1) {
          const angle = index / 8 * Math.PI * 2;
          const radius = index % 2 === 0 ? 17 : 12;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = target.primed ? COLORS.ivory : COLORS.amber;
        ctx.beginPath(); ctx.arc(0, 0, 6 + pulse * 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = target.primed ? 0.58 : 0.2;
        ctx.strokeStyle = target.primed ? COLORS.coral : COLORS.amber;
        ctx.beginPath(); ctx.arc(0, 0, 27 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'splitter':
        ctx.fillStyle = '#1A2630';
        ctx.strokeStyle = damaged ? COLORS.coral : COLORS.blue;
        ctx.beginPath();
        for (let index = 0; index < 6; index += 1) {
          const angle = index / 6 * Math.PI * 2;
          const x = Math.cos(angle) * 22;
          const y = Math.sin(angle) * 22;
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (damaged) {
          ctx.strokeStyle = COLORS.coral;
          ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(-13, -15); ctx.lineTo(-3, -2); ctx.lineTo(-9, 12); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(3, 1); ctx.lineTo(11, 15); ctx.stroke();
          ctx.fillStyle = COLORS.coral; ctx.fillRect(-4, -4, 8, 8);
        } else {
          ctx.globalAlpha = 0.68;
          ctx.strokeStyle = COLORS.blue;
          ctx.strokeRect(-8, -8, 16, 16);
          ctx.fillStyle = COLORS.ivory; ctx.fillRect(-3, -3, 6, 6);
        }
        break;
      case 'splitterFragment':
        ctx.fillStyle = COLORS.coral;
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath();
        ctx.fill();
        break;
      case 'debris':
        ctx.fillStyle = COLORS.steel;
        ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(4, -8); ctx.lineTo(9, 5); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill();
        break;
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawPremiumGalleryLabel(target: WorldTarget): void {
    const art = target.premiumArt;
    if (!art) return;
    const definition = PREMIUM_ASSETS[art];
    const height = definition.renderWidth * definition.imageHeight / definition.imageWidth;
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = definition.palette[0];
    ctx.globalAlpha = 0.82;
    ctx.font = '800 6.5px monospace';
    ctx.textAlign = 'center';
    const label = definition.label.length > 22 ? definition.label.replace(' ', '\n') : definition.label;
    const lines = label.split('\n');
    lines.forEach((line, index) => ctx.fillText(line, target.x, target.y + height * 0.5 + 12 + index * 8));
    ctx.restore();
  }

  private drawPremiumTarget(target: WorldTarget, art: PremiumArtKind): void {
    const ctx = this.context;
    const definition = PREMIUM_ASSETS[art];
    const image = this.premiumAssets.image(art);
    const height = definition.renderWidth * definition.imageHeight / definition.imageWidth;
    const primedFuel = (art === 'fuelDepot' || art === 'antimatterReactorPod') && target.primed;
    const interceptorCracked = (art === 'alienInterceptor' || art === 'shieldedCargoDrone')
      && target.hp < target.maxHp;
    const flash = Math.max(target.impactFlash, primedFuel ? 0.34 + Math.sin(target.age * 29) * 0.28 : 0);

    ctx.save();
    if (image && target.kind === 'splitterFragment') {
      const lobes = definition.fragments.filter((fragment) => fragment.stage === 'detached');
      const lobe = lobes[target.id % Math.max(1, Math.min(4, lobes.length))];
      if (lobe) {
        const sourceX = Math.round(lobe.x * definition.imageWidth);
        const sourceY = Math.round(lobe.y * definition.imageHeight);
        const sourceWidth = Math.max(1, Math.round(lobe.width * definition.imageWidth));
        const sourceHeight = Math.max(1, Math.round(lobe.height * definition.imageHeight));
        const lobeWidth = 17;
        const lobeHeight = lobeWidth * sourceHeight / sourceWidth;
        ctx.shadowColor = definition.palette[1];
        ctx.shadowBlur = this.renderQuality < 0.8 ? 0 : 4;
        ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -lobeWidth / 2, -lobeHeight / 2, lobeWidth, lobeHeight);
      }
    } else if (image) {
      ctx.shadowColor = primedFuel ? '#FF8D24' : definition.palette[1];
      ctx.shadowBlur = this.renderQuality < 0.8 ? 0 : 5 + flash * 12;
      ctx.drawImage(image, -definition.renderWidth / 2, -height / 2, definition.renderWidth, height);
      if (flash > 0.02) {
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = clamp(flash * (primedFuel ? 0.64 : 0.42), 0, 0.72);
        ctx.drawImage(image, -definition.renderWidth / 2, -height / 2, definition.renderWidth, height);
      }
    } else {
      this.drawPremiumFallback(art, definition.renderWidth, height, target.age, primedFuel);
    }

    if (primedFuel) {
      const pulse = 0.5 + Math.sin(target.age * 29) * 0.22;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.34 + pulse * 0.3;
      ctx.fillStyle = '#FFF6D7';
      ctx.beginPath(); ctx.arc(0, 0, 8 + pulse * 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#FF7B23';
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, 0, 31 + pulse * 8, 0, Math.PI * 2); ctx.stroke();
    }
    if (interceptorCracked) {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = COLORS.blue;
      ctx.globalAlpha = 0.78;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-4, -16); ctx.lineTo(2, -7); ctx.lineTo(-3, 2); ctx.lineTo(5, 13); ctx.stroke();
      ctx.fillStyle = '#FF6A22';
      ctx.beginPath(); ctx.ellipse(0, 2, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
    }
    this.drawPremiumDamageState(target, art, definition.renderWidth, height);
    ctx.restore();
  }

  private drawPremiumFallback(
    art: PremiumArtKind,
    width: number,
    height: number,
    age: number,
    primed: boolean,
  ): void {
    const ctx = this.context;
    const color = premiumFallbackColor(art);
    ctx.fillStyle = '#202A32';
    ctx.strokeStyle = primed ? COLORS.ivory : color;
    ctx.lineWidth = 2;
    if (art === 'fuelDepot' || art === 'antimatterReactorPod') {
      for (let index = 0; index < 6; index += 1) {
        const angle = index / 6 * Math.PI * 2;
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.roundRect(5, -5, width * 0.33, 10, 4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (art === 'alienInterceptor' || art === 'hunterDrone') {
      ctx.beginPath(); ctx.moveTo(0, -height * 0.5); ctx.lineTo(width * 0.48, height * 0.45); ctx.lineTo(0, height * 0.22); ctx.lineTo(-width * 0.48, height * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FF6A22'; ctx.beginPath(); ctx.ellipse(0, 2, 5, 10, 0, 0, Math.PI * 2); ctx.fill();
    } else if (art === 'shieldedCargoDrone') {
      ctx.beginPath();
      for (let index = 0; index < 8; index += 1) {
        const angle = index / 8 * Math.PI * 2;
        const x = Math.cos(angle) * width * 0.48;
        const y = Math.sin(angle) * height * 0.48;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.blue;
      for (const angle of [-Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75]) {
        ctx.beginPath(); ctx.arc(Math.cos(angle) * 11, Math.sin(angle) * 11, 5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (art === 'luxurySpaceYacht') {
      ctx.beginPath();
      ctx.moveTo(-width * 0.5, 0);
      ctx.quadraticCurveTo(-width * 0.16, -height * 0.42, width * 0.5, -height * 0.18);
      ctx.lineTo(width * 0.42, height * 0.22);
      ctx.quadraticCurveTo(-width * 0.1, height * 0.34, -width * 0.5, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#D9AB43';
      ctx.beginPath(); ctx.moveTo(-width * 0.08, 0); ctx.lineTo(width * 0.24, -height * 0.5); ctx.moveTo(width * 0.08, 0); ctx.lineTo(width * 0.36, height * 0.5); ctx.stroke();
    } else if (art === 'orbitalDatacenter') {
      for (let index = 0; index < 4; index += 1) {
        ctx.save(); ctx.rotate(index / 4 * Math.PI * 2); ctx.beginPath(); ctx.roundRect(12, -10, width * 0.34, 20, 4); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, width * 0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (art === 'crownDroneCarrier') {
      ctx.beginPath();
      ctx.moveTo(0, -height * 0.46);
      ctx.bezierCurveTo(width * 0.28, -height * 0.36, width * 0.52, 0, width * 0.42, height * 0.42);
      ctx.lineTo(0, height * 0.18);
      ctx.lineTo(-width * 0.42, height * 0.42);
      ctx.bezierCurveTo(-width * 0.52, 0, -width * 0.28, -height * 0.36, 0, -height * 0.46);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FF8724'; ctx.beginPath(); ctx.arc(0, -height * 0.04, 8, 0, Math.PI * 2); ctx.fill();
    } else {
      const panels = art === 'solarPowerStation' ? 4 : 2;
      for (let index = 0; index < panels; index += 1) {
        ctx.save(); ctx.rotate(index / panels * Math.PI * 2 + age * 0.08); ctx.fillRect(8, -6, width * 0.35, 12); ctx.strokeRect(8, -6, width * 0.35, 12); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, width * 0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  private drawPremiumDamageState(
    target: WorldTarget,
    art: PremiumArtKind,
    width: number,
    height: number,
  ): void {
    const ctx = this.context;
    const definition = PREMIUM_ASSETS[art];
    const anchors = definition.damageAnchors ?? [];
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (let index = 0; index < anchors.length; index += 1) {
      if ((target.damageMask & (1 << index)) === 0) continue;
      const anchor = anchors[index];
      if (!anchor) continue;
      const x = (anchor.x - 0.5) * width;
      const y = (anchor.y - 0.5) * height;
      const radius = definition.role === 'prestige' ? 11 : 7;
      const scorch = ctx.createRadialGradient(x, y, 1, x, y, radius);
      scorch.addColorStop(0, 'rgba(6, 8, 13, 0.94)');
      scorch.addColorStop(0.55, 'rgba(24, 29, 33, 0.78)');
      scorch.addColorStop(1, 'rgba(6, 8, 13, 0)');
      ctx.fillStyle = scorch;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = index % 2 === 0 ? definition.palette[1] : definition.palette[2];
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.8, y - radius * 0.25);
      ctx.lineTo(x - 2, y + 1);
      ctx.lineTo(x + radius * 0.55, y - radius * 0.65);
      ctx.moveTo(x - radius * 0.35, y + radius * 0.72);
      ctx.lineTo(x + 1, y + 2);
      ctx.lineTo(x + radius * 0.8, y + radius * 0.3);
      ctx.stroke();
    }

    if (art === 'crownDroneCarrier') {
      for (let bay = 0; bay < 2; bay += 1) {
        if ((target.damageMask & (1 << bay)) !== 0) continue;
        const x = bay === 0 ? -width * 0.17 : width * 0.17;
        const pulse = 0.55 + Math.sin(target.age * 7 + bay * 1.7) * 0.24;
        ctx.fillStyle = '#2ABEFF';
        ctx.globalAlpha = pulse;
        ctx.beginPath(); ctx.ellipse(x, height * 0.08, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#FF8724';
      ctx.globalAlpha = 0.72 + Math.sin(target.age * 8) * 0.18;
      ctx.beginPath(); ctx.arc(0, -height * 0.04, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (art === 'orbitalDatacenter' && target.damageMask !== 0) {
      ctx.strokeStyle = '#55E7FF';
      ctx.globalAlpha = 0.58;
      ctx.lineWidth = 1;
      const phase = target.age * 17;
      ctx.beginPath();
      ctx.moveTo(-7, -5);
      ctx.lineTo(Math.sin(phase) * 8, -12);
      ctx.lineTo(Math.cos(phase * 1.3) * 11, 7);
      ctx.lineTo(8, 13);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBoss(boss: BossState, phaseTime: number, effects: EffectsSystem): void {
    if (!boss.active && !boss.destroyed) return;
    const ctx = this.context;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    const entranceScale = 0.88 + boss.entrance * 0.12;
    ctx.scale(entranceScale, entranceScale);
    const destructionFade = boss.destroyed
      ? clamp(1 - Math.max(0, boss.destructionTime - 1.05) * 0.52, 0.2, 1)
      : 1;

    const shieldAlpha = boss.entrance < 1
      ? 0.1 + boss.entrance * 0.28
      : 0.06 + Math.min(0.24, boss.contactCooldown * 0.45);
    ctx.strokeStyle = boss.hp > 2.5 ? COLORS.blue : COLORS.coral;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = shieldAlpha;
    ctx.setLineDash([11, 12]);
    ctx.beginPath();
    ctx.ellipse(0, 22, 207 + Math.sin(phaseTime * 3) * 2, 201, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = destructionFade;

    const mothershipImage = this.premiumAssets.image('mothership');
    if (mothershipImage) {
      ctx.drawImage(
        mothershipImage,
        -MOTHERSHIP.renderWidth / 2,
        -MOTHERSHIP.renderHeight / 2,
        MOTHERSHIP.renderWidth,
        MOTHERSHIP.renderHeight,
      );
    } else this.drawMothershipFallback();

    if (boss.flash > 0 || boss.phase >= 2 || boss.destroyed) {
      const unstable = boss.destroyed
        ? 0.2 + Math.sin(boss.destructionTime * 21) * 0.1
        : boss.phase >= 2 ? 0.045 + Math.sin(phaseTime * 13) * 0.025 : 0;
      const energy = ctx.createRadialGradient(0, -8, 8, 0, -8, 158);
      energy.addColorStop(0, `rgba(255, 176, 0, ${clamp(unstable + boss.flash * 0.15, 0, 0.42)})`);
      energy.addColorStop(0.52, `rgba(255, 78, 61, ${clamp(unstable * 0.42, 0, 0.16)})`);
      energy.addColorStop(1, 'rgba(255, 78, 61, 0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = energy;
      ctx.fillRect(-207, -215, 414, 431);
      ctx.globalCompositeOperation = 'source-over';
    }

    boss.weakPoints.forEach((weakPoint) => {
      const pulse = 0.68 + Math.sin(phaseTime * 6.4 + weakPoint.index) * 0.2;
      const alive = weakPoint.active;
      if (!alive) {
        this.drawDisabledReactor(weakPoint.offsetX, weakPoint.offsetY, weakPoint.index, phaseTime, boss.phase >= 2);
        return;
      }
      const radius = 22 + (weakPoint.vulnerable ? pulse * 2.4 : 0);
      ctx.strokeStyle = weakPoint.flash > 0 ? COLORS.ivory : weakPoint.vulnerable ? COLORS.coral : COLORS.blue;
      ctx.globalAlpha = weakPoint.vulnerable ? 0.52 + pulse * 0.25 : 0.22;
      ctx.lineWidth = weakPoint.vulnerable ? 1.8 : 1;
      ctx.beginPath();
      ctx.arc(weakPoint.offsetX, weakPoint.offsetY, radius - 3, -0.42, Math.PI + 0.42);
      ctx.stroke();
      this.drawTargetBrackets(weakPoint.offsetX, weakPoint.offsetY, radius);
    });

    if (boss.phase > 0 || boss.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const weakPoint of boss.weakPoints) {
        const damage = weakPoint.active ? clamp(1 - weakPoint.hp / weakPoint.maxHp, 0, 1) : 1;
        if (damage <= 0) continue;
        const breach = ctx.createRadialGradient(
          weakPoint.offsetX,
          weakPoint.offsetY,
          1,
          weakPoint.offsetX,
          weakPoint.offsetY,
          24 + damage * 15,
        );
        breach.addColorStop(0, `rgba(243, 231, 206, ${0.18 + damage * 0.32})`);
        breach.addColorStop(0.25, `rgba(255, 116, 35, ${0.2 + damage * 0.34})`);
        breach.addColorStop(1, 'rgba(255, 78, 61, 0)');
        ctx.fillStyle = breach;
        ctx.fillRect(weakPoint.offsetX - 42, weakPoint.offsetY - 42, 84, 84);
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = boss.phase >= 2 ? COLORS.coral : COLORS.amber;
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.34 + boss.phase * 0.11;
      const scars = [
        [-128, 14, -91, 38, -66, 25],
        [104, -66, 133, -42, 118, -10],
        [-28, 88, 2, 111, 29, 92],
      ] as const;
      for (let index = 0; index < boss.phase; index += 1) {
        const scar = scars[index];
        if (!scar) continue;
        ctx.beginPath();
        ctx.moveTo(scar[0], scar[1]);
        ctx.lineTo(scar[2], scar[3]);
        ctx.lineTo(scar[4], scar[5]);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (boss.phase >= 2 && !boss.destroyed && Math.floor(phaseTime * 7) % 3 !== 0) {
      const left = boss.weakPoints[0];
      const center = boss.weakPoints[1];
      if (left && center) {
        this.drawElectricalArc(left.offsetX + 10, left.offsetY - 15, center.offsetX - 18, center.offsetY + 24, phaseTime, COLORS.blue);
      }
    }
    if (boss.destroyed) {
      const failureRadius = 30 + clamp(boss.destructionTime, 0, 1.3) * 72;
      const failure = ctx.createRadialGradient(0, -4, 2, 0, -4, failureRadius);
      failure.addColorStop(0, 'rgba(243, 231, 206, 0.92)');
      failure.addColorStop(0.18, 'rgba(255, 176, 0, 0.72)');
      failure.addColorStop(0.58, 'rgba(255, 78, 61, 0.24)');
      failure.addColorStop(1, 'rgba(255, 78, 61, 0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp(1 - boss.destructionTime * 0.16, 0.38, 1);
      ctx.fillStyle = failure;
      ctx.beginPath(); ctx.arc(0, -4, failureRadius, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    this.drawHullFragments(effects);
  }

  private drawMothershipFallback(): void {
    const ctx = this.context;
    ctx.fillStyle = '#18232D';
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -MOTHERSHIP.renderHeight * 0.48);
    ctx.lineTo(MOTHERSHIP.renderWidth * 0.48, 48);
    ctx.lineTo(MOTHERSHIP.renderWidth * 0.32, MOTHERSHIP.renderHeight * 0.44);
    ctx.lineTo(0, MOTHERSHIP.renderHeight * 0.28);
    ctx.lineTo(-MOTHERSHIP.renderWidth * 0.32, MOTHERSHIP.renderHeight * 0.44);
    ctx.lineTo(-MOTHERSHIP.renderWidth * 0.48, 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawTargetBrackets(x: number, y: number, radius: number): void {
    const ctx = this.context;
    const arm = 7;
    for (const xSign of [-1, 1]) {
      for (const ySign of [-1, 1]) {
        const cornerX = x + xSign * radius;
        const cornerY = y + ySign * radius;
        ctx.beginPath();
        ctx.moveTo(cornerX - xSign * arm, cornerY);
        ctx.lineTo(cornerX, cornerY);
        ctx.lineTo(cornerX, cornerY - ySign * arm);
        ctx.stroke();
      }
    }
  }

  private drawDisabledReactor(x: number, y: number, index: number, phaseTime: number, critical: boolean): void {
    const ctx = this.context;
    const flicker = 0.72 + Math.sin(phaseTime * (11 + index) + index * 2.3) * 0.12;
    const deadCore = ctx.createRadialGradient(x, y, 2, x, y, 31);
    deadCore.addColorStop(0, `rgba(6, 8, 13, ${flicker})`);
    deadCore.addColorStop(0.5, 'rgba(18, 24, 29, 0.78)');
    deadCore.addColorStop(1, 'rgba(6, 8, 13, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = deadCore;
    ctx.fillRect(x - 34, y - 34, 68, 68);
    ctx.strokeStyle = critical ? COLORS.coral : COLORS.amber;
    ctx.globalAlpha = 0.34 + (critical ? 0.18 : 0);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 28, y - 8); ctx.lineTo(x - 13, y - 2); ctx.lineTo(x - 5, y - 16);
    ctx.moveTo(x + 28, y + 10); ctx.lineTo(x + 12, y + 3); ctx.lineTo(x + 5, y + 18);
    ctx.stroke();
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = '#66717A';
    ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 8, y - 6); ctx.lineTo(x - 6, y + 8); ctx.stroke();
  }

  private drawElectricalArc(fromX: number, fromY: number, toX: number, toY: number, phase: number, color: string): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45 + Math.sin(phase * 19) * 0.2;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    const segments = 6;
    for (let index = 1; index < segments; index += 1) {
      const progress = index / segments;
      const offset = Math.sin(phase * 23 + index * 4.7) * 7;
      ctx.lineTo(fromX + (toX - fromX) * progress, fromY + (toY - fromY) * progress + offset);
    }
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.restore();
  }

  private drawHullFragments(effects: EffectsSystem): void {
    const mothershipImage = this.premiumAssets.image('mothership');
    if (!mothershipImage) return;
    const ctx = this.context;
    for (const fragment of effects.hullFragments) {
      if (!fragment.active) continue;
      ctx.save();
      ctx.translate(fragment.x, fragment.y);
      ctx.rotate(fragment.rotation);
      ctx.globalAlpha = clamp(fragment.life / Math.min(fragment.maxLife, 0.7), 0, 1);
      ctx.drawImage(
        mothershipImage,
        fragment.sourceX,
        fragment.sourceY,
        fragment.sourceWidth,
        fragment.sourceHeight,
        -fragment.width / 2,
        -fragment.height / 2,
        fragment.width,
        fragment.height,
      );
      ctx.restore();
    }
  }

  private drawPremiumFragments(effects: EffectsSystem): void {
    const ctx = this.context;
    for (const fragment of effects.premiumFragments) {
      if (!fragment.active) continue;
      const image = this.premiumAssets.image(fragment.art as PremiumAssetKey);
      ctx.save();
      ctx.translate(fragment.x, fragment.y);
      ctx.rotate(fragment.rotation);
      ctx.globalAlpha = clamp(fragment.life / Math.min(fragment.maxLife, 0.48), 0, 1);
      if (fragment.glow > 0.02) {
        ctx.shadowColor = PREMIUM_ASSETS[fragment.art].palette[1];
        ctx.shadowBlur = this.renderQuality < 0.8 ? 0 : fragment.glow * 9;
      }
      if (image) {
        ctx.drawImage(
          image,
          fragment.sourceX,
          fragment.sourceY,
          fragment.sourceWidth,
          fragment.sourceHeight,
          -fragment.width / 2,
          -fragment.height / 2,
          fragment.width,
          fragment.height,
        );
      } else {
        ctx.fillStyle = premiumFallbackColor(fragment.art);
        ctx.beginPath();
        ctx.moveTo(-fragment.width * 0.5, -fragment.height * 0.18);
        ctx.quadraticCurveTo(-fragment.width * 0.08, -fragment.height * 0.58, fragment.width * 0.5, -fragment.height * 0.2);
        ctx.lineTo(fragment.width * 0.34, fragment.height * 0.42);
        ctx.quadraticCurveTo(-fragment.width * 0.12, fragment.height * 0.58, -fragment.width * 0.5, -fragment.height * 0.18);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawHalo(state: RenderState): void {
    if (state.halo.mass <= 0.05) return;
    const ctx = this.context;
    const color = state.halo.colorForMass();
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.strokeStyle = color;
    const tier = state.halo.tier();
    const bands = Math.min(3, Math.max(1, tier));
    for (let band = 0; band < bands; band += 1) {
      const factor = [0.53, 0.73, 0.94][band] ?? 0.94;
      ctx.globalAlpha = 0.1 + tier * 0.035 + state.halo.pulse * (0.19 - band * 0.035);
      ctx.lineWidth = 1 + band * 0.35 + state.halo.pulse * 1.8;
      ctx.setLineDash(band === 1 ? [4, 7] : band === 2 ? [2, 5] : []);
      ctx.beginPath(); ctx.arc(0, 0, state.halo.radius * factor, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const orbiter of state.halo.orbiters) {
      if (!orbiter.active) continue;
      const distance = state.halo.radius * orbiter.distanceFactor;
      const x = Math.cos(orbiter.angle) * distance;
      const y = Math.sin(orbiter.angle) * distance;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(orbiter.angle * 2.4);
      ctx.globalAlpha = 0.56 + orbiter.brightness * 0.42;
      ctx.fillStyle = orbiter.brightness > 0.72 ? COLORS.ivory : color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.8;
      if (orbiter.shape === 0) {
        ctx.beginPath();
        ctx.moveTo(-orbiter.size, -orbiter.size * 0.16);
        ctx.quadraticCurveTo(0, -orbiter.size * 0.42, orbiter.size, -orbiter.size * 0.1);
        ctx.lineTo(orbiter.size * 0.72, orbiter.size * 0.26);
        ctx.quadraticCurveTo(-orbiter.size * 0.1, orbiter.size * 0.38, -orbiter.size, -orbiter.size * 0.16);
        ctx.fill();
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
      const launchBoost = state.phase === 'ascent'
        ? (1 - clamp(state.phaseTime / 1.8, 0, 1)) * (0.45 + state.charge * 0.85)
        : 0;
      const trailLength = clamp(speed * (0.22 + launchBoost * 0.12 + state.overdrive.value * 0.045), 26, 184);
      const gradient = ctx.createLinearGradient(
        x,
        y,
        x - Math.cos(angle) * trailLength,
        y - Math.sin(angle) * trailLength,
      );
      const arenaTrail = state.overdrive.high ? COLORS.coral : state.overdrive.value > 0.4 ? COLORS.amber : COLORS.blue;
      gradient.addColorStop(0, state.phase === 'ascent' ? COLORS.ivory : arenaTrail);
      gradient.addColorStop(0.18, state.phase === 'ascent' ? COLORS.coral : arenaTrail);
      gradient.addColorStop(1, '#44C7F400');
      ctx.save();
      ctx.strokeStyle = gradient;
      ctx.globalAlpha = 0.72 + launchBoost * 0.28;
      ctx.lineWidth = 7 + launchBoost * 9;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(angle) * trailLength, y - Math.sin(angle) * trailLength); ctx.stroke();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = state.phase === 'ascent' ? COLORS.ivory : arenaTrail;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(angle) * trailLength * 0.66, y - Math.sin(angle) * trailLength * 0.66); ctx.stroke();
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
    if (hot > 0.12) {
      const travelAngle = angle - player.rotation;
      ctx.strokeStyle = hot > 0.6 ? COLORS.ivory : COLORS.coral;
      ctx.lineWidth = 3 + hot * 2;
      ctx.globalAlpha = 0.52 + hot * 0.42;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 2.2, travelAngle - 0.85, travelAngle + 0.85);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
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

  private drawGameplayPropagation(state: RenderState): void {
    const ctx = this.context;
    ctx.save();
    for (const wave of state.chains.waves) {
      if (!wave.active) continue;
      ctx.globalAlpha = clamp(wave.life / wave.maxLife, 0, 1) * 0.42;
      ctx.strokeStyle = wave.source === 'burst' || wave.source === 'data'
        ? COLORS.blue
        : wave.source === 'mine' ? COLORS.amber : COLORS.ivory;
      ctx.lineWidth = wave.source === 'burst' ? 2.8 : wave.source === 'data' ? 3.6 : wave.source === 'mine' ? 2.2 : 1.2;
      ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2); ctx.stroke();
    }
    for (const shard of state.chains.shards) {
      if (!shard.active) continue;
      ctx.globalAlpha = clamp(shard.life / TUNING.coreBurstShardLife, 0, 1) * 0.9;
      ctx.strokeStyle = shard.penetration > 1 ? COLORS.ivory : COLORS.blue;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(shard.x, shard.y);
      ctx.lineTo(shard.x - shard.vx * 0.045, shard.y - shard.vy * 0.045);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEffects(effects: EffectsSystem): void {
    const ctx = this.context;
    ctx.save();
    for (const link of effects.links) {
      if (!link.active) continue;
      ctx.globalAlpha = clamp(link.life / link.maxLife, 0, 1) * 0.76;
      ctx.strokeStyle = link.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(link.fromX, link.fromY);
      ctx.lineTo(link.toX, link.toY);
      ctx.stroke();
    }
    for (const particle of effects.particles) {
      if (!particle.active) continue;
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      const speed = Math.hypot(particle.vx, particle.vy);
      if (particle.visual === 'wisp') {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.globalAlpha = alpha * 0.38;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (1.25 + (1 - alpha)), 0, Math.PI * 2);
        ctx.fill();
      } else if (speed > 120) {
        const length = clamp(speed * 0.025, particle.size, particle.size * 3.8);
        const angle = Math.atan2(particle.vy, particle.vx);
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(angle);
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = Math.max(0.8, particle.size * 0.55);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-length, 0);
        ctx.quadraticCurveTo(-length * 0.35, particle.size * 0.22, 0, 0);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, Math.max(0.7, particle.size * 0.42), 0, Math.PI * 2);
        ctx.fill();
      }
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
      ctx.textAlign = 'right';
      ctx.fillStyle = state.overdrive.high ? COLORS.coral : COLORS.blue;
      ctx.fillText(`OVERDRIVE ${Math.round(state.overdrive.value * 100)}%`, STAGE.width - 16, 781);
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
    for (const wave of state.chains.waves) {
      if (!wave.active) continue;
      ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2); ctx.stroke();
    }
    for (const shard of state.chains.shards) {
      if (!shard.active) continue;
      ctx.beginPath(); ctx.arc(shard.x, shard.y, shard.radius, 0, Math.PI * 2); ctx.stroke();
    }
    for (const well of state.world.gravityWells) {
      ctx.beginPath(); ctx.arc(well.x, well.y, well.radius, 0, Math.PI * 2); ctx.stroke();
    }
    if (state.phase === 'boss' && state.boss.active) {
      for (const weakPoint of state.boss.weakPoints) {
        if (!weakPoint.active) continue;
        ctx.beginPath(); ctx.arc(weakPoint.x, weakPoint.y, MOTHERSHIP.weakPointRadius, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(state.player.x + state.player.vx * 0.18, state.player.y + state.player.vy * 0.18);
    ctx.stroke();
    ctx.restore();
  }
}
