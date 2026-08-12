import { COLORS, STAGE, TUNING } from './config';
import { clamp, magnitude, normalize, sweptCircleHit } from './math';
import { createComboState, registerComboHit, tickCombo, type ComboState } from './logic/combo';
import { loadPersistedState, resetPersistedState, savePersistedState } from './logic/persistence';
import { calculateScrap, completionBonus, impactScore } from './logic/scoring';
import {
  coverIntegrityBonus,
  impactPowerMultiplier,
  launchVelocityMultiplier,
  magneticCaptureMultiplier,
  purchaseUpgrade,
} from './logic/upgrades';
import { Renderer } from './render/Renderer';
import { AudioManager } from './systems/AudioManager';
import { EffectsSystem } from './systems/EffectsSystem';
import { HaloSystem } from './systems/HaloSystem';
import { InputManager, type PointerInput } from './systems/InputManager';
import { UIController } from './systems/UIController';
import { WorldSystem } from './systems/WorldSystem';
import type {
  BossState,
  DebugSnapshot,
  GamePhase,
  Outcome,
  PersistedState,
  PlayerState,
  RunStats,
  UpgradeKey,
  WorldTarget,
} from './types';

declare global {
  interface Window {
    __PASCAL_B_DEBUG__?: {
      jumpToOrbit(): void;
      triggerBoss(): void;
      damageBoss(amount?: number): void;
      snapshot(): DebugSnapshot & { score: number; mass: number; bossHp: number; paused: boolean };
    };
  }
}

const createPlayer = (): PlayerState => ({
  x: STAGE.width / 2,
  y: 466,
  previousX: STAGE.width / 2,
  previousY: 466,
  vx: 0,
  vy: 0,
  radius: TUNING.playerRadius,
  rotation: 0,
  integrity: 100,
  maxIntegrity: 100,
  heat: 0,
  stalledFor: 0,
  impactCooldown: 0,
});

const createBoss = (): BossState => ({
  active: false,
  destroyed: false,
  entrance: 0,
  x: STAGE.width / 2,
  y: -120,
  vx: 0,
  hp: 8,
  maxHp: 8,
  contactCooldown: 0,
  flash: 0,
  timeRemaining: TUNING.bossDuration,
  droneAngle: 0,
});

const activeRunPhase = (phase: GamePhase): boolean =>
  phase === 'launch' || phase === 'ascent' || phase === 'orbit' || phase === 'boss';

export class Game {
  private readonly debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
  private readonly ui: UIController;
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly audio: AudioManager;
  private readonly effects = new EffectsSystem();
  private readonly halo = new HaloSystem();
  private readonly world = new WorldSystem();
  private persisted: PersistedState;
  private phase: GamePhase = 'boot';
  private phaseTime = 0;
  private elapsed = 0;
  private backgroundScroll = 0;
  private aim = 0;
  private charge = 0;
  private charging = false;
  private ascentProgress = 0;
  private player = createPlayer();
  private combo: ComboState = createComboState();
  private boss = createBoss();
  private score = 0;
  private objectsDestroyed = 0;
  private maximumVelocity = 0;
  private heatOvertime = 0;
  private bossEndTimer = 0;
  private paused = false;
  private reducedMotion: boolean;
  private readonly motionQuery: MediaQueryList;
  private lastTimestamp = 0;
  private accumulator = 0;
  private frameRequest = 0;
  private fps = 60;
  private hudTimer = 0;
  private debugTimer = 0;
  private chargeAuthorizationStage = 0;
  private haloThresholdStage = 0;

  public constructor(app: HTMLElement) {
    this.persisted = loadPersistedState();
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery.matches;
    this.effects.setReducedMotion(this.reducedMotion);
    this.audio = new AudioManager(this.persisted.volume, this.persisted.muted);

    this.ui = new UIController(app, {
      start: () => this.startFromTitle(),
      armTest: () => this.armTest(),
      replay: () => this.replay(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      setMuted: (muted) => this.setMuted(muted),
      setVolume: (volume) => this.setVolume(volume),
      purchaseUpgrade: (key) => this.buyUpgrade(key),
      resetProgress: () => this.resetProgress(),
      jumpToOrbit: () => this.debugJumpToOrbit(),
      triggerBoss: () => this.debugTriggerBoss(),
    }, this.debugEnabled);
    this.renderer = new Renderer(this.ui.canvas);
    this.input = new InputManager(this.ui.canvas, {
      onPointerDown: (input) => this.pointerDown(input),
      onPointerMove: (input) => this.pointerMove(input),
      onPointerUp: (input) => this.pointerUp(input),
      onChargeStart: () => this.beginCharge(),
      onChargeEnd: () => this.releaseCharge(),
      onPause: () => this.togglePause(),
      onRestart: () => this.replay(),
    });

    this.ui.syncSettings(this.persisted);
    this.ui.showPhase('boot');
    this.motionQuery.addEventListener('change', this.handleMotionChange);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('resize', this.handleResize, { passive: true });

    if (this.debugEnabled) this.installDebugApi();
    this.frameRequest = requestAnimationFrame(this.frame);
  }

  public destroy(): void {
    cancelAnimationFrame(this.frameRequest);
    this.input.destroy();
    this.motionQuery.removeEventListener('change', this.handleMotionChange);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('resize', this.handleResize);
    delete window.__PASCAL_B_DEBUG__;
  }

  private readonly frame = (timestamp: number): void => {
    if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
    const rawDelta = Math.min((timestamp - this.lastTimestamp) / 1000, TUNING.maxFrameDelta);
    this.lastTimestamp = timestamp;
    if (rawDelta > 0) this.fps += (1 / rawDelta - this.fps) * 0.08;

    if (!this.paused) {
      this.accumulator += rawDelta;
      let steps = 0;
      while (this.accumulator >= TUNING.fixedStep && steps < TUNING.maxSubSteps) {
        this.fixedUpdate(TUNING.fixedStep);
        this.accumulator -= TUNING.fixedStep;
        steps += 1;
      }
      if (steps === TUNING.maxSubSteps) this.accumulator = 0;
    }

    this.renderer.render({
      phase: this.phase,
      phaseTime: this.phaseTime,
      elapsed: this.elapsed,
      aim: this.aim,
      charge: this.charge,
      charging: this.charging,
      steering: this.input.getSteering(),
      ascentProgress: this.ascentProgress,
      backgroundScroll: this.backgroundScroll,
      player: this.player,
      world: this.world,
      halo: this.halo,
      effects: this.effects,
      boss: this.boss,
      combo: this.combo,
      score: this.score,
      reducedMotion: this.reducedMotion,
      debugEnabled: this.debugEnabled,
    });

    this.hudTimer -= rawDelta;
    if (this.hudTimer <= 0 && activeRunPhase(this.phase)) {
      this.updateHud();
      this.hudTimer = 0.08;
    }
    this.debugTimer -= rawDelta;
    if (this.debugEnabled && this.debugTimer <= 0) {
      this.ui.updateDebug(this.debugSnapshot());
      this.debugTimer = 0.2;
    }
    this.frameRequest = requestAnimationFrame(this.frame);
  };

  private fixedUpdate(delta: number): void {
    const wasFrozen = this.effects.hitStop > 0;
    this.effects.update(delta);
    if (wasFrozen) return;

    this.phaseTime += delta;
    this.backgroundScroll += delta * (this.phase === 'orbit' || this.phase === 'boss' ? 34 : 7);

    if (this.phase === 'boot') {
      if (this.phaseTime >= 0.9) this.setPhase('title');
      return;
    }
    if (!activeRunPhase(this.phase)) return;

    this.elapsed += delta;
    this.player.impactCooldown = Math.max(0, this.player.impactCooldown - delta);
    this.combo = tickCombo(this.combo, delta);
    if (this.phase === 'launch') this.updateLaunch(delta);
    if (this.phase === 'ascent') this.updateAscent(delta);
    if (this.phase === 'orbit') this.updateOrbit(delta);
    if (this.phase === 'boss') this.updateBoss(delta);
  }

  private updateLaunch(delta: number): void {
    this.aim = clamp(
      this.aim + this.input.getKeyboardSteering() * delta * 0.48,
      -TUNING.aimLimit,
      TUNING.aimLimit,
    );
    if (this.charging) {
      this.charge = clamp(this.charge + delta / TUNING.chargeSeconds, 0, 1);
      this.audio.updateCharge(this.charge);
      this.effects.shake(0.35 + this.charge * 2.1, 0.04);
      const authorizationStage = Math.min(4, Math.floor(this.charge * 4.05));
      if (authorizationStage > this.chargeAuthorizationStage) {
        this.chargeAuthorizationStage = authorizationStage;
        this.audio.chargeAuthorization(authorizationStage);
        const labels = ['PRESSURE RISING', 'INTERLOCKS CLEAR', 'AUTHORIZATION 57-B', 'MAXIMUM YIELD'];
        const label = labels[authorizationStage - 1];
        if (label) this.effects.label(label, STAGE.width / 2, 438, authorizationStage === 4 ? COLORS.coral : COLORS.ivory, 0.86);
      }
      if (this.charge >= 1 && Math.floor(this.phaseTime * 5) % 4 === 0) this.effects.flash = 0.035;
    }
    this.player.rotation += delta * (0.7 + this.charge * 5);
  }

  private updateAscent(delta: number): void {
    this.ascentProgress = clamp(this.phaseTime / TUNING.ascentDuration, 0, 1);
    const steer = this.input.getSteering();
    this.rememberPlayerPosition();
    this.player.vx += steer * 130 * delta;
    this.player.vx *= Math.pow(0.987, delta * 60);
    this.player.vx = clamp(this.player.vx, -175, 175);
    this.player.vy += 18 * delta;
    this.player.vy = Math.min(this.player.vy, -470);
    this.player.x += this.player.vx * delta;
    this.player.x = clamp(this.player.x, 28, STAGE.width - 28);
    this.player.y = 548 + Math.sin(this.phaseTime * 0.7) * 5;
    this.player.rotation += delta * (9 + Math.abs(this.player.vx) * 0.018);
    this.backgroundScroll += Math.abs(this.player.vy) * delta * 0.88;
    this.player.heat = clamp(this.player.heat + delta * (0.028 + this.charge * 0.013), 0, 1);
    this.audio.updateAscent(this.ascentProgress, Math.abs(this.player.vy) / 730, steer);

    this.world.update(delta, 'ascent', Math.abs(this.player.vy) * 0.72);
    this.handleTargetCollisions('ascent');
    this.updateVelocityRecord();
    this.checkFailure(delta);
    if (this.phase !== 'ascent') return;
    if (this.phaseTime >= TUNING.ascentDuration) this.enterOrbit();
  }

  private updateOrbit(delta: number): void {
    this.updateOrbitalPhysics(delta);
    this.world.update(delta, 'orbit');
    this.handleTargetCollisions('orbit');
    this.halo.update(delta, magnitude(this.player.vx, this.player.vy));
    this.player.heat = Math.max(0.12, this.player.heat - delta * 0.055);
    this.updateVelocityRecord();
    this.checkFailure(delta);
    if (this.phase !== 'orbit') return;

    const readyByMass = this.halo.mass >= TUNING.orbitFinaleMass && this.phaseTime >= TUNING.orbitMinimumDuration;
    if (readyByMass || this.phaseTime >= TUNING.orbitForcedFinaleTime) this.enterBoss();
  }

  private updateBoss(delta: number): void {
    if (this.boss.destroyed) {
      this.bossEndTimer -= delta;
      this.player.rotation += delta * 14;
      this.backgroundScroll += delta * 75;
      if (this.bossEndTimer <= 0) this.finishRun('victory', 'Mothership converted to expanding orbital debris.');
      return;
    }

    this.boss.entrance = clamp(this.phaseTime / 2.4, 0, 1);
    this.boss.y = -115 + this.boss.entrance * 375;
    this.boss.x = STAGE.width / 2 + Math.sin(Math.max(0, this.phaseTime - 2.4) * 0.55) * 46;
    this.boss.timeRemaining = Math.max(0, TUNING.bossDuration - this.phaseTime);
    this.boss.contactCooldown = Math.max(0, this.boss.contactCooldown - delta);
    this.boss.flash = Math.max(0, this.boss.flash - delta * 5);
    this.boss.droneAngle += delta * 0.55;

    this.updateOrbitalPhysics(delta);
    this.world.update(delta, 'boss');
    this.handleTargetCollisions('boss');
    this.handleBossCollision();
    this.halo.update(delta, magnitude(this.player.vx, this.player.vy));
    this.player.heat = Math.max(0.1, this.player.heat - delta * 0.065);
    this.updateVelocityRecord();
    this.checkFailure(delta);
    if (this.phase !== 'boss') return;
    if (this.phaseTime >= TUNING.bossDuration) {
      this.finishRun('failure', 'The interception window closed. The mothership escaped.');
    }
  }

  private updateOrbitalPhysics(delta: number): void {
    const player = this.player;
    this.rememberPlayerPosition();
    const steer = this.input.getSteering();
    player.vx += steer * 235 * delta;
    player.vy += steer * 24 * delta;
    for (const well of this.world.gravityWells) {
      const dx = well.x - player.x;
      const dy = well.y - player.y;
      const distanceSquared = Math.max(1_250, dx * dx + dy * dy);
      const gravity = well.strength / distanceSquared;
      player.vx += dx * gravity * delta;
      player.vy += dy * gravity * delta;
    }

    let speed = magnitude(player.vx, player.vy);
    if (speed > TUNING.playerMaxSpeed) {
      const scale = TUNING.playerMaxSpeed / speed;
      player.vx *= scale;
      player.vy *= scale;
      speed = TUNING.playerMaxSpeed;
    }
    if (speed < TUNING.playerMinOrbitSpeed && speed > 0) {
      const recovery = Math.min(1, delta * 0.42);
      const targetScale = TUNING.playerMinOrbitSpeed / speed;
      const scale = 1 + (targetScale - 1) * recovery;
      player.vx *= scale;
      player.vy *= scale;
    }

    player.x += player.vx * delta;
    player.y += player.vy * delta;
    const margin = player.radius + 5;
    if (player.x < margin || player.x > STAGE.width - margin) {
      player.x = clamp(player.x, margin, STAGE.width - margin);
      player.vx *= -0.91;
      this.effects.impact(player.x, player.y, 1, COLORS.blue);
      this.audio.impact(1);
      player.heat = clamp(player.heat + 0.035, 0, 1);
      player.integrity -= 0.6;
    }
    if (player.y < STAGE.hudTop + margin || player.y > STAGE.height - margin - 17) {
      player.y = clamp(player.y, STAGE.hudTop + margin, STAGE.height - margin - 17);
      player.vy *= -0.91;
      this.effects.impact(player.x, player.y, 1, COLORS.blue);
      this.audio.impact(1);
      player.heat = clamp(player.heat + 0.035, 0, 1);
      player.integrity -= 0.6;
    }
    player.rotation += delta * (7 + magnitude(player.vx, player.vy) * 0.014);
  }

  private handleTargetCollisions(flightPhase: 'ascent' | 'orbit' | 'boss'): void {
    for (const target of this.world.targets) {
      if (!target.active || target.hitCooldown > 0) continue;
      const direct = sweptCircleHit(
        { x: this.player.previousX, y: this.player.previousY },
        this.player,
        this.player.radius + (flightPhase === 'ascent' ? 6 : 2),
        target,
        target.radius,
      );
      const haloHit = flightPhase !== 'ascent'
        && this.halo.mass > 0.5
        && (target.x - this.player.x) ** 2 + (target.y - this.player.y) ** 2
          <= (this.halo.radius + target.radius * 0.7) ** 2;
      if (direct || haloHit) this.hitTarget(target, direct, flightPhase);
    }
  }

  private hitTarget(target: WorldTarget, direct: boolean, flightPhase: 'ascent' | 'orbit' | 'boss'): void {
    target.hitCooldown = direct ? 0.2 : 0.34;
    const impactMultiplier = impactPowerMultiplier(this.persisted.upgrades.reinforcedCover);
    target.hp -= direct ? impactMultiplier : 1;
    const tier: 1 | 2 | 3 = target.maxHp > 1 || target.kind === 'drone' ? 2 : 1;
    const impactDirection = Math.atan2(this.player.vy, this.player.vx);
    this.effects.impact(target.x, target.y, tier, target.kind === 'drone' ? COLORS.coral : COLORS.amber, impactDirection);
    this.audio.impact(tier);

    if (direct) {
      const direction = normalize(this.player.x - target.x, this.player.y - target.y);
      this.player.vx += direction.x * (target.maxHp > 1 ? 42 : 18);
      if (flightPhase !== 'ascent') this.player.vy += direction.y * (target.maxHp > 1 ? 42 : 18);
      if (target.maxHp > 1) {
        const armorFactor = 1 / impactPowerMultiplier(this.persisted.upgrades.reinforcedCover);
        this.player.integrity -= 3.5 * armorFactor;
        this.player.heat = clamp(this.player.heat + 0.045, 0, 1);
      }
    }
    if (target.hp <= 0) this.destroyTarget(target, flightPhase);
  }

  private destroyTarget(target: WorldTarget, flightPhase: 'ascent' | 'orbit' | 'boss'): void {
    target.active = false;
    this.combo = registerComboHit(this.combo, TUNING.comboWindow);
    this.objectsDestroyed += 1;
    const beforeMass = this.halo.mass;
    const points = impactScore(target.score, this.combo.count, beforeMass);
    this.score += points;
    const large = target.maxHp > 1 || target.kind === 'drone';
    this.effects.burst(target.x, target.y, large ? 18 : 10, large ? COLORS.ivory : COLORS.steel, large ? 280 : 190);

    if (flightPhase === 'ascent') {
      this.player.integrity = Math.min(this.player.maxIntegrity, this.player.integrity + 0.8);
      this.player.vy -= 9;
    } else {
      this.halo.addMass(target.mass, magneticCaptureMultiplier(this.persisted.upgrades.magneticRim));
      const capturedMass = this.halo.mass - beforeMass;
      this.effects.capture(target.x, target.y, this.player.x, this.player.y, capturedMass);
      this.effects.label(`+${capturedMass.toFixed(1)} t // HALO`, target.x, target.y - 18, COLORS.blue, 0.74);
      this.handleHaloThresholds(beforeMass);
    }

    if (this.combo.count === 6) {
      this.effects.label('CHAIN x6', target.x, target.y - 20, COLORS.amber, 1.1);
      this.ui.announce('CHAIN x6');
    }
    if (this.combo.count === 10) {
      this.effects.label('ORBITAL CASCADE', STAGE.width / 2, 160, COLORS.lime, 1.25);
      this.effects.shake(7, 0.22);
      this.ui.announce('ORBITAL CASCADE', 'victory');
    }
  }

  private handleBossCollision(): void {
    if (!this.boss.active || this.boss.entrance < 0.94 || this.boss.contactCooldown > 0) return;
    const dx = this.player.x - this.boss.x;
    const dy = this.player.y - this.boss.y;
    const direct = (dx / 142) ** 2 + (dy / 72) ** 2 <= 1;
    const haloReach = this.halo.mass > 3
      && (Math.abs(dx) <= 126 + this.halo.radius && Math.abs(dy) <= 48 + this.halo.radius * 0.72);
    if (!direct && !haloReach) return;

    const damage = direct
      ? impactPowerMultiplier(this.persisted.upgrades.reinforcedCover)
      : 1;
    this.damageBoss(damage);
    const away = normalize(dx, dy || 1);
    const bounce = direct ? 310 : 185;
    this.player.vx = away.x * bounce + this.player.vx * 0.35;
    this.player.vy = away.y * bounce + this.player.vy * 0.35;
    if (direct) this.player.integrity -= 4 / impactPowerMultiplier(this.persisted.upgrades.reinforcedCover);
  }

  private damageBoss(amount: number): void {
    if (!this.boss.active || this.boss.destroyed) return;
    this.boss.hp = Math.max(0, this.boss.hp - Math.max(0.1, amount));
    this.boss.contactCooldown = 0.62;
    this.boss.flash = 1;
    this.combo = registerComboHit(this.combo, TUNING.comboWindow);
    this.score += impactScore(920, this.combo.count, this.halo.mass);
    this.effects.impact(this.boss.x, this.boss.y, 3, COLORS.coral);
    const remainingRatio = this.boss.hp / this.boss.maxHp;
    const damageLabel = remainingRatio > 0.66 ? 'SHIELD FRACTURE' : remainingRatio > 0.28 ? 'HULL BREACH' : 'CORE EXPOSED';
    this.effects.label(damageLabel, this.boss.x, this.boss.y - 72, remainingRatio <= 0.28 ? COLORS.lime : COLORS.ivory, 1.08);
    this.audio.impact(3);
    this.audio.bossDamage(remainingRatio);
    if (this.boss.hp <= 0) this.destroyBoss();
  }

  private destroyBoss(): void {
    if (this.boss.destroyed) return;
    this.boss.active = false;
    this.boss.destroyed = true;
    this.bossEndTimer = 2.7;
    this.score += completionBonus(true, this.player.integrity) + 7_500;
    this.combo = registerComboHit(this.combo, TUNING.comboWindow);
    this.objectsDestroyed += 1;
    this.halo.addMass(12, magneticCaptureMultiplier(this.persisted.upgrades.magneticRim));
    this.effects.hitStop = 0.13;
    this.effects.flash = this.reducedMotion ? 0.18 : 0.66;
    this.effects.shake(11, 0.6);
    this.effects.clearLabels();
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      const x = this.boss.x + Math.cos(angle) * 72;
      const y = this.boss.y + Math.sin(angle) * 36;
      this.effects.burst(x, y, 20, index % 2 === 0 ? COLORS.coral : COLORS.blue, 350);
      this.effects.ring(x, y, 105 + index * 18, index % 2 === 0 ? COLORS.ivory : COLORS.blue, 3);
    }
    this.effects.label('ONE FRAME. ZERO SURVIVORS.', STAGE.width / 2, 165, COLORS.ivory, 1.2);
    this.ui.announce('MOTHERSHIP DESTROYED', 'victory');
    this.audio.bossDestroyed();
  }

  private updateVelocityRecord(): void {
    const velocity = this.currentVelocityKmS();
    this.maximumVelocity = Math.max(this.maximumVelocity, velocity);
  }

  private checkFailure(delta: number): void {
    if (!activeRunPhase(this.phase) || this.phase === 'launch') return;
    const speed = magnitude(this.player.vx, this.player.vy);
    this.player.stalledFor = speed < 105 ? this.player.stalledFor + delta : 0;
    this.heatOvertime = this.player.heat >= 0.99 ? this.heatOvertime + delta : Math.max(0, this.heatOvertime - delta * 2);
    if (this.player.integrity <= 0) {
      this.finishRun('failure', 'Repeated heavy impacts fractured the reinforced rim.');
    } else if (this.player.stalledFor > 4.5) {
      this.finishRun('failure', 'Velocity fell below a recoverable orbital path.');
    } else if (this.heatOvertime > 1.8) {
      this.finishRun('failure', 'Thermal instability forced the cover off-course.');
    }
  }

  private enterOrbit(): void {
    if (this.phase === 'orbit') return;
    this.setPhase('orbit');
    this.audio.stopAscent();
    this.player.x = clamp(this.player.x, 80, STAGE.width - 80);
    this.player.y = 610;
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.player.vx = Math.sin(this.aim) * 330 + this.player.vx * 0.45;
    this.player.vy = -390;
    this.world.enterOrbit();
    this.effects.flash = this.reducedMotion ? 0.06 : 0.15;
    this.effects.ring(this.player.x, this.player.y, 90, COLORS.blue, 2);
    this.ui.announce('ORBITAL INSERTION');
    this.audio.warning();
  }

  private enterBoss(): void {
    if (this.phase === 'boss') return;
    this.setPhase('boss');
    this.boss = createBoss();
    this.boss.active = true;
    this.world.enterBoss();
    this.effects.shake(7, 0.48);
    this.effects.ring(STAGE.width / 2, 160, 180, COLORS.coral, 3);
    this.ui.announce('UNKNOWN CONTACT // INTERCEPT', 'warning');
    this.audio.bossEntrance();
  }

  private releaseLaunch(): void {
    if (this.phase !== 'launch' || !this.charging) return;
    this.charging = false;
    this.charge = Math.max(this.charge, TUNING.minimumCharge);
    this.audio.stopCharge(true);
    this.effects.hitStop = TUNING.launchHitStop * (0.72 + this.charge * 0.28);
    this.effects.flash = this.reducedMotion ? 0.16 : 0.48 + this.charge * 0.24;
    this.effects.shake(5.5 + this.charge * 5, 0.28 + this.charge * 0.18);
    this.effects.launch(this.player.x, this.player.y, this.charge);

    const baseVelocity = (540 + this.charge * 190)
      * launchVelocityMultiplier(this.persisted.upgrades.launchPressure);
    this.player.vx = Math.sin(this.aim) * baseVelocity * 0.35;
    this.player.vy = -baseVelocity;
    this.player.x += Math.sin(this.aim) * 14;
    this.player.y = 548;
    this.setPhase('ascent');
    this.world.startAscent();
    this.audio.startAscent();
    this.maximumVelocity = this.currentVelocityKmS();
    this.ui.announce('SHAFT RELEASE // ASCENT');
  }

  private finishRun(outcome: Outcome, reason: string): void {
    if (this.phase === 'results') return;
    const victory = outcome === 'victory';
    const finalScore = Math.round(this.score);
    const scrapEarned = calculateScrap(finalScore, this.objectsDestroyed, victory);
    const stats: RunStats = {
      maximumVelocity: this.maximumVelocity,
      objectsDestroyed: this.objectsDestroyed,
      largestCombo: Math.max(1, this.combo.largest),
      wreckageMass: this.halo.mass,
      totalScore: finalScore,
      scrapEarned,
      mothershipDestroyed: victory,
      elapsedSeconds: this.elapsed,
    };
    this.persisted = {
      ...this.persisted,
      bestScore: Math.max(this.persisted.bestScore, finalScore),
      scrap: this.persisted.scrap + scrapEarned,
    };
    savePersistedState(this.persisted);
    this.input.clearPointerSteering();
    this.charging = false;
    this.audio.stopCharge(false);
    this.audio.stopAscent();
    this.setPhase('results');
    this.ui.showResults(outcome, stats, this.persisted, reason);
    this.ui.syncSettings(this.persisted);
    this.audio.resultsTally(victory);
  }

  private startFromTitle(): void {
    void this.audio.unlock();
    this.audio.ui();
    if (this.persisted.seenHint) this.beginRun();
    else this.setPhase('hint');
  }

  private armTest(): void {
    void this.audio.unlock();
    this.persisted = { ...this.persisted, seenHint: true };
    savePersistedState(this.persisted);
    this.audio.ui();
    this.beginRun();
  }

  private beginRun(): void {
    this.audio.stopCharge(false);
    this.audio.stopAscent();
    this.effects.clear();
    this.halo.reset();
    this.world.reset();
    this.player = createPlayer();
    this.player.maxIntegrity += coverIntegrityBonus(this.persisted.upgrades.reinforcedCover);
    this.player.integrity = this.player.maxIntegrity;
    this.boss = createBoss();
    this.combo = createComboState();
    this.aim = 0;
    this.charge = 0;
    this.charging = false;
    this.ascentProgress = 0;
    this.elapsed = 0;
    this.score = 0;
    this.objectsDestroyed = 0;
    this.maximumVelocity = 0;
    this.heatOvertime = 0;
    this.bossEndTimer = 0;
    this.chargeAuthorizationStage = 0;
    this.haloThresholdStage = 0;
    this.paused = false;
    this.accumulator = 0;
    this.input.clearPointerSteering();
    this.ui.setPaused(false);
    this.ui.openSettings(false);
    this.setPhase('launch');
    this.ui.announce('DRAG · HOLD · RELEASE');
  }

  private replay(): void {
    if (this.phase !== 'results') return;
    void this.audio.unlock();
    this.audio.ui();
    this.beginRun();
  }

  private beginCharge(): void {
    if (this.phase !== 'launch' || this.paused) return;
    this.charging = true;
    void this.audio.unlock().then(() => this.audio.startCharge());
  }

  private releaseCharge(): void {
    if (this.phase === 'launch') this.releaseLaunch();
  }

  private pointerDown(_input: PointerInput): void {
    if (this.phase === 'launch' && !this.paused) this.beginCharge();
  }

  private pointerMove(input: PointerInput): void {
    if (this.phase !== 'launch' || this.paused) return;
    this.aim = clamp(this.aim + input.deltaX * 0.0026, -TUNING.aimLimit, TUNING.aimLimit);
  }

  private pointerUp(_input: PointerInput): void {
    if (this.phase === 'launch') this.releaseLaunch();
  }

  private togglePause(): void {
    if (!activeRunPhase(this.phase)) return;
    if (this.paused) this.resume(); else this.pause();
  }

  private pause(): void {
    if (!activeRunPhase(this.phase) || this.paused) return;
    this.paused = true;
    this.audio.stopCharge(false);
    this.audio.stopAscent();
    this.charging = false;
    this.ui.setPaused(true);
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.accumulator = 0;
    this.lastTimestamp = performance.now();
    this.ui.openSettings(false);
    this.ui.setPaused(false);
    void this.audio.unlock();
    if (this.phase === 'ascent') this.audio.startAscent();
  }

  private setMuted(muted: boolean): void {
    this.persisted = { ...this.persisted, muted };
    this.audio.setMuted(muted);
    savePersistedState(this.persisted);
    this.ui.syncSettings(this.persisted);
    if (!muted) void this.audio.unlock().then(() => this.audio.ui());
  }

  private setVolume(volume: number): void {
    this.persisted = { ...this.persisted, volume: clamp(volume, 0, 1) };
    this.audio.setVolume(this.persisted.volume);
    savePersistedState(this.persisted);
    this.ui.syncSettings(this.persisted);
  }

  private buyUpgrade(key: UpgradeKey): void {
    const result = purchaseUpgrade(this.persisted, key);
    if (!result.purchased) {
      this.ui.updateUpgradePanel(
        this.persisted,
        result.reason === 'max-level' ? 'TRACK MAXIMUM REACHED' : 'INSUFFICIENT SCRAP',
      );
      return;
    }
    this.persisted = result.state;
    savePersistedState(this.persisted);
    this.audio.ui();
    this.ui.updateUpgradePanel(this.persisted, 'MODIFICATION INSTALLED');
  }

  private resetProgress(): void {
    this.persisted = resetPersistedState();
    this.audio.setMuted(this.persisted.muted);
    this.audio.setVolume(this.persisted.volume);
    this.ui.syncSettings(this.persisted);
    this.ui.updateUpgradePanel(this.persisted, 'LOCAL RECORDS ERASED');
    this.audio.ui();
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.phaseTime = 0;
    this.ui.showPhase(phase);
  }

  private updateHud(): void {
    const phaseLabel: Record<'launch' | 'ascent' | 'orbit' | 'boss', string> = {
      launch: 'TEST SHAFT / ARMED',
      ascent: `ATMOSPHERIC ASCENT / ${Math.round(this.ascentProgress * 100)} KM`,
      orbit: 'LOW ORBIT / CASCADE ZONE',
      boss: 'ALIEN INTERCEPT / FIRING SOLUTION',
    };
    const activePhase = this.phase as 'launch' | 'ascent' | 'orbit' | 'boss';
    this.ui.updateHud({
      velocity: this.phase === 'launch' ? 0 : this.currentVelocityKmS(),
      combo: this.combo.count,
      comboProgress: this.combo.timer / TUNING.comboWindow,
      mass: this.halo.mass,
      massProgress: this.halo.mass / TUNING.orbitFinaleMass,
      heat: this.player.heat,
      integrity: this.player.integrity,
      maxIntegrity: this.player.maxIntegrity,
      score: this.score,
      phaseLabel: phaseLabel[activePhase],
      bossProgress: this.phase === 'boss' ? this.boss.hp / this.boss.maxHp : undefined,
      bossTime: this.phase === 'boss' ? this.boss.timeRemaining : undefined,
    });
  }

  private currentVelocityKmS(): number {
    return magnitude(this.player.vx, this.player.vy) * 0.026;
  }

  private rememberPlayerPosition(): void {
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
  }

  private handleHaloThresholds(previousMass: number): void {
    for (let index = this.haloThresholdStage; index < TUNING.haloThresholds.length; index += 1) {
      const threshold = TUNING.haloThresholds[index];
      if (threshold === undefined || previousMass >= threshold || this.halo.mass < threshold) continue;
      this.haloThresholdStage = index + 1;
      const finalCritical = threshold === TUNING.orbitFinaleMass;
      const label = finalCritical ? 'MASS CRITICAL' : `HALO STAGE ${index + 1}`;
      const color = index >= 3 ? COLORS.lime : index >= 1 ? COLORS.amber : COLORS.blue;
      this.effects.haloThreshold(this.player.x, this.player.y, index + 1);
      this.effects.label(label, this.player.x, this.player.y - this.halo.radius - 15, color, 1.02 + index * 0.05);
      this.ui.announce(finalCritical ? 'MASS CRITICAL // INTERCEPT READY' : `${label} // CAPTURE RADIUS INCREASED`, finalCritical ? 'warning' : 'neutral');
      this.audio.haloThreshold(index + 1);
    }
  }

  private debugJumpToOrbit(): void {
    if (!this.debugEnabled) return;
    if (!activeRunPhase(this.phase)) this.beginRun();
    if (this.phase === 'launch' || this.phase === 'ascent') {
      this.charge = 0.88;
      this.player.vx = 90;
      this.player.vy = -650;
      this.maximumVelocity = this.currentVelocityKmS();
      this.enterOrbit();
      this.halo.addMass(9, 1);
      this.score += 2_400;
    }
  }

  private debugTriggerBoss(): void {
    if (!this.debugEnabled) return;
    this.debugJumpToOrbit();
    if (this.phase === 'orbit') {
      this.halo.addMass(28, 1);
      // Keep the debug-assisted victory representative of a good early run so the
      // browser loop can verify a first upgrade without changing live rewards.
      this.score += 80_000;
      this.enterBoss();
    }
  }

  private debugSnapshot(): DebugSnapshot {
    return {
      fps: this.fps,
      phase: this.phase,
      velocityX: this.player.vx,
      velocityY: this.player.vy,
      targets: this.world.activeCount(),
      particles: this.effects.particles.reduce((count, particle) => count + (particle.active ? 1 : 0), 0),
      haloOrbiters: this.halo.activeCount(),
      comboTimer: this.combo.timer,
    };
  }

  private installDebugApi(): void {
    window.__PASCAL_B_DEBUG__ = {
      jumpToOrbit: () => this.debugJumpToOrbit(),
      triggerBoss: () => this.debugTriggerBoss(),
      damageBoss: (amount = 1) => this.damageBoss(amount),
      snapshot: () => ({
        ...this.debugSnapshot(),
        score: this.score,
        mass: this.halo.mass,
        bossHp: this.boss.hp,
        paused: this.paused,
      }),
    };
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden && activeRunPhase(this.phase) && !this.paused) this.pause();
  };

  private readonly handleMotionChange = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    this.effects.setReducedMotion(event.matches);
  };

  private readonly handleResize = (): void => this.renderer.resize();
}
