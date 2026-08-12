import { COLORS, STAGE, TUNING } from './config';
import {
  chainMilestone,
  minePrimeDelay,
  shockwaveCanHit,
  shockwaveDamage,
  shockwaveRadius,
} from './logic/chain';
import { createComboState, registerComboHit, tickCombo, type ComboState } from './logic/combo';
import { HALO_TIER_LABELS } from './logic/halo';
import {
  createOverdriveState,
  overdriveScoreMultiplier,
  registerOverdriveDestruction,
  tickOverdrive,
  type OverdriveState,
} from './logic/overdrive';
import { loadPersistedState, resetPersistedState, savePersistedState } from './logic/persistence';
import { calculateScrap, completionBonus, impactScore } from './logic/scoring';
import {
  coverIntegrityBonus,
  impactPowerMultiplier,
  launchVelocityMultiplier,
  magneticCaptureMultiplier,
  purchaseUpgrade,
} from './logic/upgrades';
import { clamp, magnitude, normalize, sweptCircleHit } from './math';
import { Renderer } from './render/Renderer';
import { AudioManager } from './systems/AudioManager';
import { ChainSystem } from './systems/ChainSystem';
import { EffectsSystem } from './systems/EffectsSystem';
import { HaloSystem } from './systems/HaloSystem';
import { InputManager, type PointerInput } from './systems/InputManager';
import { UIController } from './systems/UIController';
import { WorldSystem } from './systems/WorldSystem';
import type {
  BossState,
  BossWeakPoint,
  DamageSource,
  DebugSnapshot,
  FormationKind,
  GamePhase,
  Outcome,
  PersistedState,
  PlayerState,
  RunStats,
  UpgradeKey,
  Vec2,
  WorldTarget,
} from './types';

interface DebugApi {
  jumpToOrbit(): void;
  enterArena(): void;
  triggerBoss(): void;
  startMothership(): void;
  damageBoss(amount?: number): void;
  fillBurst(): void;
  coreBurst(): void;
  spawnFormation(kind: FormationKind): void;
  snapshot(): DebugSnapshot & {
    score: number;
    mass: number;
    peakMass: number;
    bossHp: number;
    paused: boolean;
  };
}

declare global {
  interface Window {
    __PASCAL_B_DEBUG__?: DebugApi;
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
  burstSafetyTimer: 0,
});

const createWeakPoint = (index: number, offsetX: number, offsetY: number): BossWeakPoint => ({
  index,
  offsetX,
  offsetY,
  x: STAGE.width / 2 + offsetX,
  y: 215 + offsetY,
  hp: 6,
  maxHp: 6,
  active: true,
  vulnerable: index === 0,
  flash: 0,
});

const createBoss = (): BossState => ({
  active: false,
  destroyed: false,
  entrance: 0,
  x: STAGE.width / 2,
  y: -120,
  vx: 0,
  hp: 18,
  maxHp: 18,
  contactCooldown: 0,
  flash: 0,
  timeRemaining: 0,
  droneAngle: 0,
  phase: 0,
  weakPoints: [
    createWeakPoint(0, -76, 8),
    createWeakPoint(1, 0, -16),
    createWeakPoint(2, 76, 8),
  ],
});

const activeRunPhase = (phase: GamePhase): boolean =>
  phase === 'launch' || phase === 'ascent' || phase === 'orbit' || phase === 'boss';

const inArenaPhase = (phase: GamePhase): boolean => phase === 'orbit' || phase === 'boss';

export class Game {
  private readonly debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
  private readonly ui: UIController;
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly audio: AudioManager;
  private readonly effects = new EffectsSystem();
  private readonly halo = new HaloSystem();
  private readonly world = new WorldSystem();
  private readonly chains = new ChainSystem();
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
  private overdrive: OverdriveState = createOverdriveState();
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
  private maximumHaloTier = 0;
  private runCounter = 0;
  private runSeed = Math.floor(Date.now() % 100_000) + 1;
  private launchQuality = 0;
  private lowFrameTime = 0;
  private cosmeticQuality = 1;

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
      coreBurst: () => this.activateCoreBurst(),
      spawnFormation: (kind) => this.debugSpawnFormation(kind),
      fillBurst: () => this.debugFillBurst(),
    }, this.debugEnabled);
    this.renderer = new Renderer(this.ui.canvas);
    this.input = new InputManager(this.ui.canvas, {
      onPointerDown: (input) => this.pointerDown(input),
      onPointerMove: (input) => this.pointerMove(input),
      onPointerUp: (input) => this.pointerUp(input),
      onChargeStart: () => this.actionStart(),
      onChargeEnd: () => this.actionEnd(),
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
    this.audio.destroy();
    this.ui.destroy();
    this.motionQuery.removeEventListener('change', this.handleMotionChange);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('resize', this.handleResize);
    delete window.__PASCAL_B_DEBUG__;
  }

  private readonly frame = (timestamp: number): void => {
    if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
    const rawDelta = Math.min((timestamp - this.lastTimestamp) / 1000, TUNING.maxFrameDelta);
    this.lastTimestamp = timestamp;
    if (rawDelta > 0) {
      this.fps += (1 / rawDelta - this.fps) * 0.08;
      this.updateCosmeticQuality(rawDelta);
    }

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
      chains: this.chains,
      effects: this.effects,
      boss: this.boss,
      combo: this.combo,
      overdrive: this.overdrive,
      score: this.score,
      reducedMotion: this.reducedMotion,
      cosmeticQuality: this.cosmeticQuality,
      debugEnabled: this.debugEnabled,
    });

    this.hudTimer -= rawDelta;
    if (this.hudTimer <= 0 && activeRunPhase(this.phase)) {
      this.updateHud();
      this.hudTimer = 0.07;
    }
    this.debugTimer -= rawDelta;
    if (this.debugEnabled && this.debugTimer <= 0) {
      this.ui.updateDebug(this.debugSnapshot());
      this.debugTimer = 0.16;
    }
    this.frameRequest = requestAnimationFrame(this.frame);
  };

  private fixedUpdate(delta: number): void {
    const wasFrozen = this.effects.hitStop > 0;
    this.effects.update(delta);
    if (wasFrozen) return;

    this.phaseTime += delta;
    this.backgroundScroll += delta * (inArenaPhase(this.phase) ? 48 + this.overdrive.value * 38 : 9);

    if (this.phase === 'boot') {
      if (this.phaseTime >= 0.9) this.setPhase('title');
      return;
    }
    if (!activeRunPhase(this.phase)) return;

    this.elapsed += delta;
    this.player.burstSafetyTimer = Math.max(0, this.player.burstSafetyTimer - delta);
    this.combo = tickCombo(this.combo, delta);
    if (this.phase === 'launch') this.updateLaunch(delta);
    if (this.phase === 'ascent') this.updateAscent(delta);
    if (this.phase === 'orbit') this.updateOrbit(delta);
    if (this.phase === 'boss') this.updateBoss(delta);
  }

  private updateLaunch(delta: number): void {
    this.aim = clamp(
      this.aim + this.input.getKeyboardSteering().x * delta * 0.5,
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
    this.player.vx += steer.x * 145 * delta;
    this.player.vx *= Math.pow(0.987, delta * 60);
    this.player.vx = clamp(this.player.vx, -185, 185);
    this.player.vy = Math.min(this.player.vy + 16 * delta, -475);
    this.player.x = clamp(this.player.x + this.player.vx * delta, 28, STAGE.width - 28);
    this.player.y = 548 + Math.sin(this.phaseTime * 2.4) * 4;
    this.player.rotation += delta * (10 + Math.abs(this.player.vx) * 0.02);
    this.backgroundScroll += Math.abs(this.player.vy) * delta * 1.15;
    this.player.heat = clamp(this.player.heat + delta * (0.1 + this.charge * 0.035), 0, 0.72);
    this.audio.updateAscent(this.ascentProgress, Math.abs(this.player.vy) / 730, steer.x);

    this.world.update(delta, 'ascent', this.player, this.phaseTime, 0, 0, Math.abs(this.player.vy) * 0.9);
    this.handleTargetCollisions();
    this.updateVelocityRecord();
    this.checkFailure(delta);
    if (this.phase === 'ascent' && this.phaseTime >= TUNING.ascentDuration) this.enterOrbit();
  }

  private updateOrbit(delta: number): void {
    this.updateOrbitalPhysics(delta);
    this.chains.update(delta);
    this.world.update(delta, 'orbit', this.player, this.phaseTime, this.overdrive.value);
    this.resolveArenaInteractions();
    this.halo.update(delta, magnitude(this.player.vx, this.player.vy));
    this.halo.addBurstCharge(delta * (0.008 + this.overdrive.value * 0.006));
    this.updateOverdrive(delta);
    this.player.heat = Math.max(0.08, this.player.heat - delta * 0.09);
    this.updateVelocityRecord();
    this.checkFailure(delta);
    if (this.phase === 'orbit' && this.phaseTime >= TUNING.orbitDuration) this.enterBoss();
  }

  private updateBoss(delta: number): void {
    if (this.boss.destroyed) {
      this.bossEndTimer -= delta;
      this.player.rotation += delta * 14;
      this.backgroundScroll += delta * 95;
      if (this.bossEndTimer <= 0) this.finishRun('victory', 'Three weak points breached. The interception grid became the final cascade.');
      return;
    }

    this.boss.entrance = clamp(this.phaseTime / 1.75, 0, 1);
    this.boss.y = -115 + this.boss.entrance * 332;
    this.boss.x = STAGE.width / 2 + Math.sin(Math.max(0, this.phaseTime - 1.7) * 0.72) * 34;
    this.boss.contactCooldown = Math.max(0, this.boss.contactCooldown - delta);
    this.boss.flash = Math.max(0, this.boss.flash - delta * 5);
    this.boss.droneAngle += delta * (0.7 + this.boss.phase * 0.16);
    this.syncBossWeakPoints(delta);

    this.updateOrbitalPhysics(delta);
    this.chains.update(delta);
    this.world.update(delta, 'boss', this.player, this.phaseTime, this.overdrive.value, this.boss.phase);
    this.resolveArenaInteractions();
    this.handleBossContact();
    this.handleBossWaveAndShardHits();
    this.halo.update(delta, magnitude(this.player.vx, this.player.vy));
    this.halo.addBurstCharge(delta * (0.008 + this.overdrive.value * 0.006));
    this.updateOverdrive(delta);
    this.player.heat = Math.max(0.07, this.player.heat - delta * 0.1);
    this.updateVelocityRecord();
    this.checkFailure(delta);
  }

  private updateOrbitalPhysics(delta: number): void {
    const player = this.player;
    this.rememberPlayerPosition();
    const steering = this.input.getSteering();
    const steeringStrength = magnitude(steering.x, steering.y);
    let speed = Math.max(1, magnitude(player.vx, player.vy));
    if (steeringStrength > 0.06) {
      const desired = normalize(steering.x, steering.y);
      const desiredVx = desired.x * speed;
      const desiredVy = desired.y * speed;
      const bend = clamp(
        TUNING.steeringAcceleration * (1 + this.overdrive.value * 0.12) / speed * delta,
        0,
        0.085,
      );
      player.vx += (desiredVx - player.vx) * bend;
      player.vy += (desiredVy - player.vy) * bend;
    }

    for (const well of this.world.gravityWells) {
      const dx = well.x - player.x;
      const dy = well.y - player.y;
      const distanceSquared = Math.max(1_400, dx * dx + dy * dy);
      const gravity = well.strength / distanceSquared;
      player.vx += dx * gravity * delta;
      player.vy += dy * gravity * delta;
    }

    speed = magnitude(player.vx, player.vy);
    const maxSpeed = TUNING.playerMaxSpeed * (1 + this.overdrive.value * 0.1);
    if (speed > maxSpeed) {
      player.vx *= maxSpeed / speed;
      player.vy *= maxSpeed / speed;
      speed = maxSpeed;
    }
    const minimumSpeed = TUNING.playerMinOrbitSpeed * (1 + this.overdrive.value * 0.08);
    if (speed < minimumSpeed) {
      const recovery = Math.min(1, delta * 0.7);
      const scale = 1 + (minimumSpeed / speed - 1) * recovery;
      player.vx *= scale;
      player.vy *= scale;
    }

    player.x += player.vx * delta;
    player.y += player.vy * delta;
    const margin = player.radius + 5;
    if (player.x < margin || player.x > STAGE.width - margin) {
      player.x = clamp(player.x, margin, STAGE.width - margin);
      player.vx *= -0.84;
      this.effects.explosion(player.x, player.y, 'spark', COLORS.blue);
      this.audio.impact(1);
      player.integrity -= 0.15;
    }
    if (player.y < STAGE.hudTop + margin || player.y > TUNING.playerArenaBottom) {
      player.y = clamp(player.y, STAGE.hudTop + margin, TUNING.playerArenaBottom);
      player.vy *= -0.84;
      this.effects.explosion(player.x, player.y, 'spark', COLORS.blue);
      this.audio.impact(1);
      player.integrity -= 0.15;
    }
    player.rotation += delta * (8 + magnitude(player.vx, player.vy) * 0.016);
  }

  private resolveArenaInteractions(): void {
    this.handleTargetCollisions();
    this.handleBurstShardCollisions();
    this.handleGameplayWaveCollisions();
    this.detonatePrimedMines();
  }

  private handleTargetCollisions(): void {
    const arena = inArenaPhase(this.phase);
    for (const target of this.world.targets) {
      if (!target.active || target.telegraph > 0) continue;
      const direct = sweptCircleHit(
        { x: this.player.previousX, y: this.player.previousY },
        this.player,
        this.player.radius + (this.phase === 'ascent' ? 6 : 2),
        target,
        target.radius,
      );
      const directEligible = direct && target.coverHitCooldown <= 0;
      const haloHit = arena
        && target.hitCooldown <= 0
        && this.halo.tier() > 0
        && (target.x - this.player.x) ** 2 + (target.y - this.player.y) ** 2
          <= (this.halo.radius + target.radius * 0.72) ** 2;
      if (!directEligible && !haloHit) continue;

      const source: DamageSource = directEligible ? 'cover' : 'halo';
      if (directEligible) target.coverHitCooldown = 0.22;
      else target.hitCooldown = 0.2;
      if (directEligible) this.applyDirectContact(target);
      const amount = directEligible
        ? impactPowerMultiplier(this.persisted.upgrades.reinforcedCover)
        : this.halo.contactDamage();
      this.damageTarget(target, amount, source, 0, { x: this.player.x, y: this.player.y });
    }
  }

  private handleBurstShardCollisions(): void {
    for (const shard of this.chains.shards) {
      if (!shard.active) continue;
      for (const target of this.world.targets) {
        if (!shard.active || !target.active || target.telegraph > 0 || shard.hitTargetIds.includes(target.id)) continue;
        if (!sweptCircleHit(
          { x: shard.previousX, y: shard.previousY },
          shard,
          shard.radius,
          target,
          target.radius,
        )) continue;
        shard.hitTargetIds.push(target.id);
        shard.penetration -= 1;
        this.damageTarget(target, 1.2, 'burst', 1, { x: shard.previousX, y: shard.previousY });
        if (shard.penetration <= 0) shard.active = false;
      }
    }
  }

  private handleGameplayWaveCollisions(): void {
    let impactBudget = TUNING.maxChainImpactsPerStep;
    for (const wave of this.chains.waves) {
      if (!wave.active || impactBudget <= 0) continue;
      for (const target of this.world.targets) {
        if (impactBudget <= 0) return;
        if (!target.active || target.telegraph > 0) continue;
        const distance = Math.hypot(target.x - wave.x, target.y - wave.y);
        if (!shockwaveCanHit(distance, target.radius, wave.radius, wave.hitTargetIds.includes(target.id))) continue;
        wave.hitTargetIds.push(target.id);
        impactBudget -= 1;
        this.damageTarget(target, wave.damage, wave.source, wave.depth + 1, { x: wave.x, y: wave.y });
      }
    }
  }

  private damageTarget(
    target: WorldTarget,
    amount: number,
    source: DamageSource,
    depth: number,
    origin?: Vec2,
  ): void {
    if (!target.active) return;
    if (target.kind === 'mine') {
      const delay = source === 'shockwave' ? minePrimeDelay(depth) : source === 'halo' ? 0.09 : 0.055;
      const newlyPrimed = this.world.prime(target, delay, depth);
      if (newlyPrimed) {
        this.effects.ring(target.x, target.y, 34, COLORS.coral, 1.5);
        this.audio.minePrime();
        if (origin) this.effects.link(origin.x, origin.y, target.x, target.y, COLORS.coral);
      }
      return;
    }

    target.hp -= Math.max(0.1, amount);
    const color = target.kind === 'swarmer' || target.kind === 'splitter' || target.kind === 'splitterFragment'
      ? COLORS.coral
      : COLORS.amber;
    this.effects.burst(target.x, target.y, target.kind === 'splitter' ? 7 : 3, color, 130);
    if (target.hp <= 0) this.destroyTarget(target, source, depth, origin);
  }

  private destroyTarget(target: WorldTarget, source: DamageSource, depth: number, origin?: Vec2): void {
    if (!target.active) return;
    const kind = target.kind;
    const x = target.x;
    const y = target.y;
    const wasSplitter = kind === 'splitter';
    target.active = false;

    this.combo = registerComboHit(this.combo, TUNING.comboWindow);
    this.objectsDestroyed += 1;
    const arena = inArenaPhase(this.phase);
    const points = impactScore(target.score, this.combo.count, this.halo.mass)
      * overdriveScoreMultiplier(this.overdrive.value);
    this.score += Math.round(points);

    if (arena) {
      const previousTier = this.halo.tier();
      const capturedMass = this.halo.addMass(
        target.mass,
        magneticCaptureMultiplier(this.persisted.upgrades.magneticRim),
      );
      this.halo.addBurstCharge(
        0.01 + target.mass * 0.002 + (this.combo.count >= 5 ? 0.003 : 0) + (kind === 'mine' ? 0.01 : 0),
      );
      this.overdrive = registerOverdriveDestruction(this.overdrive, this.combo.count, kind === 'mine');
      if (this.combo.count >= 5) {
        this.player.integrity = Math.min(this.player.maxIntegrity, this.player.integrity + 0.025);
      }
      if (this.objectsDestroyed % 3 === 0 || target.mass > 1.5) {
        this.effects.capture(x, y, this.player.x, this.player.y, capturedMass);
        this.audio.capture(this.halo.tier());
      }
      this.handleHaloTierTransition(previousTier);
    } else {
      this.player.integrity = Math.min(this.player.maxIntegrity, this.player.integrity + 0.7);
      this.player.vy -= 8;
    }

    if (wasSplitter) this.world.split(target, 3 + target.id % 3);
    const explosionTier = kind === 'mine'
      ? 'cascade'
      : wasSplitter || kind === 'solar' || kind === 'satellite'
        ? 'burst'
        : 'spark';
    const color = kind === 'mine'
      ? COLORS.amber
      : kind === 'swarmer' || kind === 'splitter' || kind === 'splitterFragment'
        ? COLORS.coral
        : COLORS.blue;
    this.effects.explosion(x, y, explosionTier, color, Math.atan2(this.player.vy, this.player.vx));
    if (origin && (source === 'shockwave' || source === 'burst' || source === 'mine')) {
      this.effects.link(origin.x, origin.y, x, y, source === 'burst' ? COLORS.blue : COLORS.amber);
    }
    this.audio.chainTick(this.combo.count, kind === 'mine');

    if (arena) {
      const radius = shockwaveRadius(kind, this.combo.count);
      if (depth < 5) {
        this.chains.emitWave(
          x,
          y,
          radius,
          shockwaveDamage(kind),
          depth,
          kind === 'mine' ? 'mine' : 'shockwave',
        );
      }
      const milestone = chainMilestone(this.combo.count);
      if (milestone) this.presentChainMilestone(milestone, x, y);
    }
  }

  private detonatePrimedMines(): void {
    let detonations = 0;
    for (const target of this.world.targets) {
      if (!target.active || target.kind !== 'mine' || !target.primed || target.primeTimer > 0) continue;
      const dx = this.player.x - target.x;
      const dy = this.player.y - target.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (distance < 104 && this.player.burstSafetyTimer <= 0) {
        const armor = impactPowerMultiplier(this.persisted.upgrades.reinforcedCover);
        const haloShield = 1 - this.halo.tier() * 0.16;
        this.player.integrity -= target.contactDamage / armor * Math.max(0.36, haloShield);
        this.player.vx += dx / distance * 58;
        this.player.vy += dy / distance * 58;
      }
      this.audio.mineDetonate();
      this.destroyTarget(target, 'mine', target.chainDepth, { x: target.x, y: target.y });
      detonations += 1;
      if (detonations >= 6) break;
    }
  }

  private applyDirectContact(target: WorldTarget): void {
    const away = normalize(this.player.x - target.x, this.player.y - target.y || 1);
    const heavy = target.kind === 'mine' || target.kind === 'splitter';
    this.player.vx += away.x * (heavy ? 42 : 16);
    if (this.phase !== 'ascent') this.player.vy += away.y * (heavy ? 42 : 16);
    if (target.contactDamage > 0 && target.kind !== 'mine') {
      const armor = impactPowerMultiplier(this.persisted.upgrades.reinforcedCover);
      const haloShield = Math.max(0.48, 1 - this.halo.tier() * 0.12);
      this.player.integrity -= target.contactDamage / armor * haloShield;
      this.player.heat = clamp(this.player.heat + target.contactDamage * 0.004, 0, 1);
    }
  }

  private activateCoreBurst(): void {
    if (!inArenaPhase(this.phase) || this.paused) return;
    const outcome = this.halo.consumeBurst(this.persisted.upgrades.magneticRim);
    if (!outcome) {
      this.audio.warning();
      return;
    }
    this.chains.fireBurst(this.player.x, this.player.y, outcome.shardCount, this.player.rotation * 0.19);
    this.chains.emitWave(this.player.x, this.player.y, outcome.waveRadius, 1.15, 0, 'burst');
    this.effects.clearLabels();
    this.effects.explosion(this.player.x, this.player.y, 'catastrophe', COLORS.blue);
    this.effects.ring(this.player.x, this.player.y, outcome.waveRadius, COLORS.lime, 3);
    this.ui.announce(`CORE BURST // ${outcome.shardCount} VECTORS`, 'victory');
    this.audio.coreBurst();
    this.player.burstSafetyTimer = 0.42;
    this.overdrive = {
      value: clamp(this.overdrive.value + 0.12, 0, 1),
      high: this.overdrive.high || this.overdrive.value + 0.12 >= TUNING.overdriveHighThreshold,
    };
  }

  private updateOverdrive(delta: number): void {
    const grazing = this.isGrazingDanger();
    const wasHigh = this.overdrive.high;
    this.overdrive = tickOverdrive(this.overdrive, delta, this.combo.count >= 3, grazing);
    if (!wasHigh && this.overdrive.high) {
      this.effects.clearLabels();
      this.effects.label('OVERDRIVE', this.player.x, this.player.y - this.halo.radius - 18, COLORS.coral, 1.08);
      this.ui.announce('OVERDRIVE // CASCADE DENSITY RISING', 'warning');
    }
    this.audio.updateOverdrive(this.overdrive.value, this.overdrive.high);
  }

  private isGrazingDanger(): boolean {
    for (const target of this.world.targets) {
      if (!target.active || target.telegraph > 0 || (target.kind !== 'mine' && target.kind !== 'swarmer')) continue;
      const distance = Math.hypot(target.x - this.player.x, target.y - this.player.y);
      const collision = this.player.radius + target.radius;
      if (distance > collision + 8 && distance < collision + 48) return true;
    }
    return false;
  }

  private presentChainMilestone(milestone: string, x: number, y: number): void {
    this.effects.clearLabels();
    const color = milestone === 'ONE FRAME' ? COLORS.ivory : milestone === 'MASS EVENT' ? COLORS.lime : COLORS.amber;
    this.effects.label(milestone, x, y - 26, color, milestone === 'ONE FRAME' ? 1.28 : 1.12);
    this.effects.shake(milestone === 'ONE FRAME' ? 9 : milestone === 'MASS EVENT' ? 6.5 : 4.5, 0.18);
    this.audio.chainMilestone(this.combo.count);
  }

  private handleHaloTierTransition(previousTier: number): void {
    const tier = this.halo.tier();
    if (tier <= previousTier || tier <= this.maximumHaloTier) return;
    this.maximumHaloTier = tier;
    const label = HALO_TIER_LABELS[tier] ?? 'HALO ESCALATION';
    this.effects.haloThreshold(this.player.x, this.player.y, tier);
    this.ui.announce(`${label} // CONTACT POWER INCREASED`, tier >= 3 ? 'warning' : 'neutral');
    this.audio.haloThreshold(tier);
  }

  private syncBossWeakPoints(delta: number): void {
    for (const weakPoint of this.boss.weakPoints) {
      weakPoint.x = this.boss.x + weakPoint.offsetX;
      weakPoint.y = this.boss.y + weakPoint.offsetY;
      weakPoint.flash = Math.max(0, weakPoint.flash - delta * 5.5);
    }
    this.boss.hp = this.boss.weakPoints.reduce((total, weakPoint) => total + Math.max(0, weakPoint.hp), 0);
  }

  private currentWeakPoint(): BossWeakPoint | null {
    return this.boss.weakPoints.find((weakPoint) => weakPoint.active && weakPoint.vulnerable) ?? null;
  }

  private handleBossContact(): void {
    if (!this.boss.active || this.boss.entrance < 0.92 || this.boss.contactCooldown > 0) return;
    const weakPoint = this.currentWeakPoint();
    if (!weakPoint) return;
    const direct = sweptCircleHit(
      { x: this.player.previousX, y: this.player.previousY },
      this.player,
      this.player.radius + 2,
      weakPoint,
      21,
    );
    const haloHit = this.halo.tier() > 0
      && Math.hypot(weakPoint.x - this.player.x, weakPoint.y - this.player.y) <= this.halo.radius + 18;
    if (!direct && !haloHit) return;
    this.damageWeakPoint(
      weakPoint,
      direct ? impactPowerMultiplier(this.persisted.upgrades.reinforcedCover) : this.halo.contactDamage() * 0.62,
      direct ? 'cover' : 'halo',
      { x: this.player.x, y: this.player.y },
    );
    const away = normalize(this.player.x - weakPoint.x, this.player.y - weakPoint.y || 1);
    const bounce = direct ? 265 : 145;
    this.player.vx = away.x * bounce + this.player.vx * 0.45;
    this.player.vy = away.y * bounce + this.player.vy * 0.45;
    if (direct) this.player.integrity -= 2.2 / impactPowerMultiplier(this.persisted.upgrades.reinforcedCover);
  }

  private handleBossWaveAndShardHits(): void {
    const weakPoint = this.currentWeakPoint();
    if (!weakPoint || this.boss.contactCooldown > 0 || this.boss.entrance < 0.92) return;
    for (const wave of this.chains.waves) {
      const weakPointKey = -(weakPoint.index + 1);
      if (!wave.active || wave.hitTargetIds.includes(weakPointKey)) continue;
      const distance = Math.hypot(weakPoint.x - wave.x, weakPoint.y - wave.y);
      if (!shockwaveCanHit(distance, 20, wave.radius, false)) continue;
      wave.hitTargetIds.push(weakPointKey);
      this.damageWeakPoint(weakPoint, wave.source === 'burst' ? 1.15 : 0.75, wave.source, { x: wave.x, y: wave.y });
      return;
    }
    for (const shard of this.chains.shards) {
      const weakPointKey = -(weakPoint.index + 1);
      if (!shard.active || shard.hitTargetIds.includes(weakPointKey)) continue;
      if (!sweptCircleHit({ x: shard.previousX, y: shard.previousY }, shard, shard.radius, weakPoint, 20)) continue;
      shard.hitTargetIds.push(weakPointKey);
      shard.penetration -= 1;
      this.damageWeakPoint(weakPoint, 1, 'burst', { x: shard.previousX, y: shard.previousY });
      return;
    }
  }

  private damageWeakPoint(
    weakPoint: BossWeakPoint,
    amount: number,
    source: DamageSource,
    origin?: Vec2,
    bypassCooldown = false,
  ): void {
    if (!this.boss.active || this.boss.destroyed || !weakPoint.active || !weakPoint.vulnerable) return;
    if (!bypassCooldown && this.boss.contactCooldown > 0) return;
    weakPoint.hp = Math.max(0, weakPoint.hp - Math.max(0.1, amount));
    weakPoint.flash = 1;
    this.boss.flash = 1;
    this.boss.contactCooldown = bypassCooldown ? 0 : 0.27;
    this.score += Math.round(impactScore(760, Math.max(1, this.combo.count), this.halo.mass)
      * overdriveScoreMultiplier(this.overdrive.value));
    this.effects.explosion(weakPoint.x, weakPoint.y, 'burst', COLORS.coral);
    if (origin) this.effects.link(origin.x, origin.y, weakPoint.x, weakPoint.y, source === 'burst' ? COLORS.blue : COLORS.coral);
    this.audio.bossDamage(this.boss.hp / this.boss.maxHp);
    if (weakPoint.hp <= 0) this.breakWeakPoint(weakPoint);
  }

  private breakWeakPoint(weakPoint: BossWeakPoint): void {
    weakPoint.active = false;
    weakPoint.vulnerable = false;
    this.combo = registerComboHit(this.combo, TUNING.comboWindow);
    this.objectsDestroyed += 1;
    this.score += Math.round(2_600 * overdriveScoreMultiplier(this.overdrive.value));
    this.halo.addMass(3.2, magneticCaptureMultiplier(this.persisted.upgrades.magneticRim));
    this.halo.addBurstCharge(0.16);
    this.overdrive = registerOverdriveDestruction(this.overdrive, this.combo.count, true);
    this.boss.phase = weakPoint.index + 1;
    this.boss.contactCooldown = 1.05;
    this.chains.emitWave(weakPoint.x, weakPoint.y, 138, 1.15, 1, 'shockwave');
    this.effects.clearLabels();
    this.effects.explosion(weakPoint.x, weakPoint.y, 'catastrophe', COLORS.coral);
    this.effects.label(`WEAK POINT ${weakPoint.index + 1} BREACHED`, STAGE.width / 2, 145, COLORS.lime, 1.08);
    this.ui.announce(`BREACH ${weakPoint.index + 1} / 3 // VOLATILE ESCORTS`, 'victory');
    const next = this.boss.weakPoints[weakPoint.index + 1];
    if (next) {
      this.world.spawnBossEscort(weakPoint.index + 1, this.boss.x, this.boss.y, this.player);
      next.vulnerable = true;
    } else {
      this.destroyBoss();
    }
  }

  private destroyBoss(): void {
    if (this.boss.destroyed) return;
    this.boss.active = false;
    this.boss.destroyed = true;
    this.boss.hp = 0;
    this.bossEndTimer = 2.8;
    this.score += completionBonus(true, this.player.integrity) + 8_000;
    this.combo = registerComboHit(this.combo, TUNING.comboWindow);
    this.effects.hitStop = 0.12;
    this.effects.flash = this.reducedMotion ? 0.16 : 0.52;
    this.effects.shake(11, 0.6);
    this.effects.clearLabels();
    for (const escort of this.world.detonateFinalEscorts(24)) {
      this.effects.explosion(escort.x, escort.y, escort.kind === 'mine' ? 'cascade' : 'spark', COLORS.coral);
    }
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      const x = this.boss.x + Math.cos(angle) * 74;
      const y = this.boss.y + Math.sin(angle) * 38;
      this.effects.explosion(x, y, index % 2 === 0 ? 'catastrophe' : 'cascade', index % 2 === 0 ? COLORS.coral : COLORS.blue);
    }
    this.ui.announce('MOTHERSHIP CASCADE COMPLETE', 'victory');
    this.audio.bossDestroyed();
  }

  private updateVelocityRecord(): void {
    this.maximumVelocity = Math.max(this.maximumVelocity, this.currentVelocityKmS());
  }

  private checkFailure(delta: number): void {
    if (!activeRunPhase(this.phase) || this.phase === 'launch') return;
    const speed = magnitude(this.player.vx, this.player.vy);
    this.player.stalledFor = speed < 105 ? this.player.stalledFor + delta : 0;
    this.heatOvertime = this.player.heat >= 0.99 ? this.heatOvertime + delta : Math.max(0, this.heatOvertime - delta * 2);
    if (this.player.integrity <= 0) {
      this.finishRun('failure', 'The interception grid overwhelmed the reinforced rim.');
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
    this.player.x = clamp(this.player.x, 72, STAGE.width - 72);
    this.player.y = 628;
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    const entrySpeed = (340 + this.launchQuality * 82)
      * launchVelocityMultiplier(this.persisted.upgrades.launchPressure);
    this.player.vx = Math.sin(this.aim) * entrySpeed * 0.72 + this.player.vx * 0.32;
    this.player.vy = -entrySpeed * Math.cos(this.aim * 0.4);
    this.world.enterOrbit(this.player);
    this.effects.flash = this.reducedMotion ? 0.05 : 0.13;
    this.effects.ring(this.player.x, this.player.y, 92, COLORS.blue, 2);
    this.ui.announce('ORBITAL PANIC // CONTACT IMMINENT', 'warning');
    this.audio.warning();
  }

  private enterBoss(): void {
    if (this.phase === 'boss') return;
    this.setPhase('boss');
    this.boss = createBoss();
    this.boss.active = true;
    this.world.enterBoss(this.player);
    this.effects.shake(7, 0.48);
    this.effects.ring(STAGE.width / 2, 160, 180, COLORS.coral, 3);
    this.ui.announce('MOTHERSHIP // THREE WEAK POINTS', 'warning');
    this.audio.bossEntrance();
  }

  private releaseLaunch(): void {
    if (this.phase !== 'launch' || !this.charging) return;
    this.charging = false;
    this.charge = Math.max(this.charge, TUNING.minimumCharge);
    this.launchQuality = this.charge;
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
    const launchIntegrityBonus = this.charge * 10;
    this.player.maxIntegrity += launchIntegrityBonus;
    this.player.integrity += launchIntegrityBonus;
    this.halo.addBurstCharge(0.12 + this.charge * 0.14);
    this.overdrive = createOverdriveState(
      0.035 + this.charge * 0.055 + this.persisted.upgrades.launchPressure * 0.05,
    );
    this.setPhase('ascent');
    this.world.startAscent();
    this.audio.startAscent();
    this.maximumVelocity = this.currentVelocityKmS();
    this.ui.announce('SHAFT RELEASE // RAPID ASCENT');
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
      wreckageMass: this.halo.peakMass,
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
    this.input.reset();
    this.charging = false;
    this.audio.stopCharge(false);
    this.audio.stopAscent();
    this.audio.updateOverdrive(0, false);
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
    this.audio.updateOverdrive(0, false);
    this.effects.clear();
    this.halo.reset();
    this.chains.reset();
    this.runCounter += 1;
    this.runSeed += 7919 + this.runCounter * 17;
    this.world.reset(this.runSeed);
    this.player = createPlayer();
    this.player.maxIntegrity += coverIntegrityBonus(this.persisted.upgrades.reinforcedCover);
    this.player.integrity = this.player.maxIntegrity;
    this.boss = createBoss();
    this.combo = createComboState();
    this.overdrive = createOverdriveState();
    this.aim = 0;
    this.charge = 0;
    this.launchQuality = 0;
    this.charging = false;
    this.ascentProgress = 0;
    this.elapsed = 0;
    this.score = 0;
    this.objectsDestroyed = 0;
    this.maximumVelocity = 0;
    this.heatOvertime = 0;
    this.bossEndTimer = 0;
    this.chargeAuthorizationStage = 0;
    this.maximumHaloTier = 0;
    this.paused = false;
    this.accumulator = 0;
    this.input.reset();
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

  private actionStart(): void {
    if (this.phase === 'launch') this.beginCharge();
    else if (inArenaPhase(this.phase)) this.activateCoreBurst();
  }

  private actionEnd(): void {
    if (this.phase === 'launch') this.releaseLaunch();
  }

  private beginCharge(): void {
    if (this.phase !== 'launch' || this.paused) return;
    this.charging = true;
    void this.audio.unlock().then(() => this.audio.startCharge());
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
    this.audio.updateOverdrive(0, false);
    this.charging = false;
    this.input.reset();
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
      ascent: `ASCENT MONTAGE / ${Math.round(this.ascentProgress * 100)} KM`,
      orbit: `ORBITAL PANIC / DENSITY ${Math.round(this.world.spawnIntensity * 100)}`,
      boss: `MOTHERSHIP BREACH / PHASE ${Math.min(3, this.boss.phase + 1)}`,
    };
    const activePhase = this.phase as 'launch' | 'ascent' | 'orbit' | 'boss';
    const haloTier = this.halo.tier();
    this.ui.updateHud({
      velocity: this.phase === 'launch' ? 0 : this.currentVelocityKmS(),
      combo: this.combo.count,
      comboProgress: this.combo.timer / TUNING.comboWindow,
      mass: this.halo.mass,
      massProgress: this.halo.mass / (TUNING.haloThresholds[3] ?? 34),
      haloTierLabel: haloTier >= 4 ? 'CATASTROPHE' : HALO_TIER_LABELS[haloTier] ?? 'NO HALO',
      burstCharge: this.halo.burstCharge,
      burstReady: this.halo.canBurst(),
      burstMassReady: this.halo.mass >= TUNING.coreBurstMinimumMass,
      overdrive: this.overdrive.value,
      overdriveHigh: this.overdrive.high,
      heat: this.player.heat,
      integrity: this.player.integrity,
      maxIntegrity: this.player.maxIntegrity,
      score: this.score,
      phaseLabel: phaseLabel[activePhase],
      bossProgress: this.phase === 'boss' ? this.boss.hp / this.boss.maxHp : undefined,
      bossPhase: this.phase === 'boss' ? this.boss.phase : undefined,
    });
  }

  private currentVelocityKmS(): number {
    return magnitude(this.player.vx, this.player.vy) * 0.026;
  }

  private rememberPlayerPosition(): void {
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
  }

  private updateCosmeticQuality(rawDelta: number): void {
    this.lowFrameTime = rawDelta > 1 / 42
      ? Math.min(2, this.lowFrameTime + rawDelta)
      : Math.max(0, this.lowFrameTime - rawDelta * 0.55);
    const quality = this.lowFrameTime > 1.1 ? 0.58 : this.lowFrameTime < 0.2 && this.fps > 52 ? 1 : this.cosmeticQuality;
    if (quality !== this.cosmeticQuality) {
      this.cosmeticQuality = quality;
      this.effects.setQuality(quality);
    }
  }

  private debugJumpToOrbit(): void {
    if (!this.debugEnabled) return;
    if (!activeRunPhase(this.phase)) this.beginRun();
    if (this.phase === 'launch' || this.phase === 'ascent') {
      this.charge = 0.88;
      this.launchQuality = this.charge;
      this.player.vx = 80;
      this.player.vy = -650;
      this.halo.addBurstCharge(0.24);
      this.maximumVelocity = this.currentVelocityKmS();
      this.enterOrbit();
      this.halo.addMass(6, 1);
      this.score += 2_400;
    }
  }

  private debugTriggerBoss(): void {
    if (!this.debugEnabled) return;
    this.debugJumpToOrbit();
    if (this.phase === 'orbit') {
      this.halo.addMass(18, 1);
      this.score += 80_000;
      this.enterBoss();
    }
  }

  private debugSpawnFormation(kind: FormationKind): void {
    if (!this.debugEnabled) return;
    this.debugJumpToOrbit();
    if (inArenaPhase(this.phase)) this.world.spawnFormation(kind, this.player, 0.12);
  }

  private debugFillBurst(): void {
    if (!this.debugEnabled) return;
    this.debugJumpToOrbit();
    this.halo.fillBurst();
    this.updateHud();
  }

  private debugDamageBoss(amount: number): void {
    const weakPoint = this.currentWeakPoint();
    if (!weakPoint) return;
    this.damageWeakPoint(weakPoint, amount, 'cover', undefined, true);
  }

  private debugSnapshot(): DebugSnapshot {
    const weakPoint = this.currentWeakPoint();
    return {
      fps: this.fps,
      phase: this.phase,
      phaseTime: this.phaseTime,
      elapsed: this.elapsed,
      velocityX: this.player.vx,
      velocityY: this.player.vy,
      playerX: this.player.x,
      playerY: this.player.y,
      bossPhase: this.boss.phase,
      weakPointX: weakPoint?.x ?? this.boss.x,
      weakPointY: weakPoint?.y ?? this.boss.y,
      targets: this.world.activeCount(),
      enemies: this.world.activeEnemyCount(),
      particles: this.effects.particles.reduce((count, particle) => count + (particle.active ? 1 : 0), 0),
      shockwaves: this.effects.shockwaves.reduce((count, wave) => count + (wave.active ? 1 : 0), 0),
      gameplayWaves: this.chains.activeWaveCount(),
      burstShards: this.chains.activeShardCount(),
      haloOrbiters: this.halo.activeCount(),
      haloTier: this.halo.tier(),
      burstCharge: this.halo.burstCharge,
      overdrive: this.overdrive.value,
      spawnIntensity: this.world.spawnIntensity,
      runSeed: this.world.runSeed,
      peakTargets: this.world.peakActive,
      droppedSpawns: this.world.droppedSpawns + this.chains.droppedWaves,
      comboCount: this.combo.count,
      largestCombo: this.combo.largest,
      comboTimer: this.combo.timer,
      maximumMass: TUNING.haloMassCapacity,
    };
  }

  private installDebugApi(): void {
    window.__PASCAL_B_DEBUG__ = {
      jumpToOrbit: () => this.debugJumpToOrbit(),
      enterArena: () => this.debugJumpToOrbit(),
      triggerBoss: () => this.debugTriggerBoss(),
      startMothership: () => this.debugTriggerBoss(),
      damageBoss: (amount = 1) => this.debugDamageBoss(amount),
      fillBurst: () => this.debugFillBurst(),
      coreBurst: () => this.activateCoreBurst(),
      spawnFormation: (kind) => this.debugSpawnFormation(kind),
      snapshot: () => ({
        ...this.debugSnapshot(),
        score: this.score,
        mass: this.halo.mass,
        peakMass: this.halo.peakMass,
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
