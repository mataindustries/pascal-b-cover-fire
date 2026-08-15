import { STAGE, TUNING } from '../config';
import {
  PREMIUM_AMBIENT_KINDS,
  PREMIUM_ART_KINDS,
  PREMIUM_ASSETS,
  PREMIUM_PRESTIGE_KINDS,
  isPrestigeArt,
  premiumGameplayKind,
  prestigeSubsystemCount,
  targetVisualArt,
} from '../assets/premium';
import { PremiumShuffleBag } from '../logic/premiumRoster';
import { clamp, seededNoise } from '../math';
import type {
  FlightPhase,
  FormationKind,
  GravityWell,
  PlayerState,
  PremiumArtKind,
  TargetKind,
  WorldTarget,
} from '../types';

interface TargetProfile {
  radius: number;
  hp: number;
  mass: number;
  score: number;
  contactDamage: number;
}

const PROFILES: Record<TargetKind, TargetProfile> = {
  balloon: { radius: 18, hp: 1, mass: 0.7, score: 120, contactDamage: 0 },
  instrument: { radius: 12, hp: 1, mass: 0.9, score: 160, contactDamage: 0 },
  aircraft: { radius: 24, hp: 1, mass: 1.4, score: 260, contactDamage: 0 },
  satellite: { radius: 18, hp: 1, mass: 1.7, score: 280, contactDamage: 0.4 },
  solar: { radius: 24, hp: 1, mass: 2, score: 350, contactDamage: 0.5 },
  debris: { radius: 9, hp: 1, mass: 0.5, score: 90, contactDamage: 0.2 },
  swarmer: { radius: 11, hp: 1, mass: 0.65, score: 230, contactDamage: 1.1 },
  mine: { radius: 17, hp: 1, mass: 1.15, score: 440, contactDamage: 3.2 },
  splitter: { radius: 22, hp: 2, mass: 2.8, score: 620, contactDamage: 3.2 },
  splitterFragment: { radius: 8, hp: 1, mass: 0.42, score: 175, contactDamage: 0.8 },
  yacht: { radius: 36, hp: 6, mass: 4.8, score: 1_800, contactDamage: 1.8 },
  datacenter: { radius: 42, hp: 5, mass: 6.2, score: 2_400, contactDamage: 2.1 },
  carrier: { radius: 50, hp: 5, mass: 7.4, score: 3_200, contactDamage: 3.6 },
};

const isEnemyKind = (kind: TargetKind): boolean =>
  kind === 'swarmer' || kind === 'mine' || kind === 'splitter'
  || kind === 'splitterFragment' || kind === 'carrier';

export class WorldSystem {
  public readonly targets: WorldTarget[];
  public readonly gravityWells: GravityWell[] = [];
  public spawnIntensity = 0;
  public peakActive = 0;
  public droppedSpawns = 0;
  public runSeed = 1;
  public galleryMode = false;
  private nextId = 1;
  private nextFormationId = 1;
  private spawnTimer = 0;
  private ascentWave = 0;
  private randomSeed = 10;
  private formationCursor = 0;
  private prestigeSpawnIndex = 0;
  private readonly ambientDeck = new PremiumShuffleBag(PREMIUM_AMBIENT_KINDS);
  private readonly prestigeDeck = new PremiumShuffleBag(PREMIUM_PRESTIGE_KINDS);
  private readonly premiumKindsSeen = new Set<PremiumArtKind>();

  public constructor() {
    this.targets = Array.from({ length: TUNING.maxWorldObjects }, () => this.createEmptyTarget());
  }

  public reset(runSeed = 1): void {
    for (const target of this.targets) {
      target.active = false;
      target.carrierLaunched = false;
      target.launchedCount = 0;
      target.damageMask = 0;
      target.launchTimer = 0;
    }
    this.gravityWells.length = 0;
    this.nextId = 1;
    this.nextFormationId = 1;
    this.spawnTimer = 0;
    this.ascentWave = 0;
    this.runSeed = Math.max(1, Math.floor(runSeed));
    this.randomSeed = this.runSeed * 97 + 10;
    this.formationCursor = this.runSeed % 7;
    this.prestigeSpawnIndex = 0;
    this.ambientDeck.reset(this.runSeed * 31 + 7);
    this.prestigeDeck.reset(this.runSeed * 43 + 11);
    this.premiumKindsSeen.clear();
    this.galleryMode = false;
    this.spawnIntensity = 0;
    this.peakActive = 0;
    this.droppedSpawns = 0;
  }

  public startAscent(): void {
    for (const target of this.targets) target.active = false;
    this.gravityWells.length = 0;
    this.spawnTimer = 0.18;
    this.ascentWave = 0;
  }

  public spawnTargetForTest(kind: TargetKind, x: number, y: number, vx = 0, vy = 0): WorldTarget | null {
    return this.spawn(kind, x, y, vx, vy, 0, this.nextFormationId++);
  }

  public spawnPremiumTargetForTest(art: PremiumArtKind, x: number, y: number): WorldTarget | null {
    return this.spawn(premiumGameplayKind(art), x, y, 0, 0, 0, this.nextFormationId++, false, art);
  }

  public spawnPremiumGallery(damaged = false): readonly WorldTarget[] {
    for (const target of this.targets) target.active = false;
    this.gravityWells.length = 0;
    this.galleryMode = true;
    const spawned: WorldTarget[] = [];
    for (let index = 0; index < PREMIUM_ART_KINDS.length; index += 1) {
      const art = PREMIUM_ART_KINDS[index];
      if (!art) continue;
      const column = index % 3;
      const row = Math.floor(index / 3);
      const target = this.spawn(
        premiumGameplayKind(art),
        75 + column * 150,
        148 + row * 142,
        0,
        0,
        0,
        this.nextFormationId++,
        true,
        art,
      );
      if (!target) continue;
      target.rotation = art === 'luxurySpaceYacht' ? -0.12 : 0;
      target.launchTimer = Number.POSITIVE_INFINITY;
      spawned.push(target);
    }
    if (damaged) this.setPremiumGalleryDamageState();
    return spawned;
  }

  public spawnPremiumFocus(art: PremiumArtKind, damaged = false): WorldTarget | null {
    for (const target of this.targets) target.active = false;
    this.gravityWells.length = 0;
    this.galleryMode = true;
    const target = this.spawn(
      premiumGameplayKind(art),
      STAGE.width / 2,
      350,
      0,
      0,
      0,
      this.nextFormationId++,
      true,
      art,
    );
    if (!target) return null;
    target.rotation = art === 'luxurySpaceYacht' ? -0.12 : 0;
    target.launchTimer = Number.POSITIVE_INFINITY;
    if (damaged) this.applyGalleryDamage(target);
    return target;
  }

  public setPremiumGalleryDamageState(): void {
    for (const target of this.targets) {
      if (target.active && target.premiumArt) this.applyGalleryDamage(target);
    }
  }

  public leaveGallery(): void {
    this.galleryMode = false;
  }

  public enterOrbit(player: PlayerState): void {
    for (const target of this.targets) target.active = false;
    this.gravityWells.length = 0;
    this.spawnTimer = 1.15;
    this.galleryMode = false;
    this.spawnOpeningCascade(player);
  }

  public enterBoss(player: PlayerState): void {
    for (const target of this.targets) target.active = false;
    this.gravityWells.length = 0;
    this.spawnTimer = 0.7;
    this.galleryMode = false;
    this.spawnBossEscort(0, STAGE.width / 2, 230, player);
    this.ensurePremiumTargets(player, 0, true);
  }

  public update(
    delta: number,
    phase: FlightPhase,
    player: PlayerState,
    phaseTime = 0,
    overdrive = 0,
    bossPhase = 0,
    ascentSpeed = 0,
  ): void {
    if (this.galleryMode) {
      for (const target of this.targets) {
        if (target.active) target.impactFlash = Math.max(0, target.impactFlash - delta * 1.2);
      }
      return;
    }
    for (const well of this.gravityWells) well.phase += delta;
    for (const target of this.targets) {
      if (!target.active) continue;
      target.age += delta;
      target.hitCooldown = Math.max(0, target.hitCooldown - delta);
      target.coverHitCooldown = Math.max(0, target.coverHitCooldown - delta);
      target.telegraph = Math.max(0, target.telegraph - delta);
      if (target.primed) target.primeTimer = Math.max(0, target.primeTimer - delta);
      target.impactFlash = Math.max(0, target.impactFlash - delta * 5.6);
      target.launchTimer = Math.max(0, target.launchTimer - delta);
      target.rotation += target.spin * delta;

      if (target.telegraph > 0) continue;
      if (phase === 'ascent') {
        target.y += (target.vy + ascentSpeed) * delta;
        target.x += target.vx * delta;
        if (target.y > STAGE.height + 60) target.active = false;
        continue;
      }

      this.updateTargetBehavior(target, player, delta, phase === 'boss' ? 1 + bossPhase * 0.12 : 1);
      target.x += target.vx * delta;
      target.y += target.vy * delta;
      const padding = 105;
      if (target.x < -padding || target.x > STAGE.width + padding
        || target.y < STAGE.hudTop - padding || target.y > STAGE.height + padding) {
        target.active = false;
      }
    }

    if (phase === 'orbit' || phase === 'boss') this.launchCarrierDrones(player);

    this.peakActive = Math.max(this.peakActive, this.activeCount());
    this.spawnTimer -= delta;
    if (phase === 'ascent' && this.spawnTimer <= 0) this.spawnAscentWave();
    if (phase === 'orbit' && this.spawnTimer <= 0) this.replenishArena(player, phaseTime, overdrive);
    if (phase === 'boss' && this.spawnTimer <= 0) this.replenishBoss(player, phaseTime, bossPhase, overdrive);
  }

  public activeCount(): number {
    return this.targets.reduce((count, target) => count + (target.active ? 1 : 0), 0);
  }

  public activeEnemyCount(): number {
    return this.targets.reduce(
      (count, target) => count + (target.active && isEnemyKind(target.kind) ? 1 : 0),
      0,
    );
  }

  public activePremiumCount(): number {
    return this.targets.reduce(
      (count, target) => count + (target.active && target.premiumArt !== null ? 1 : 0),
      0,
    );
  }

  public activeTexturedCount(): number {
    return this.targets.reduce(
      (count, target) => count + (target.active && targetVisualArt(target.kind, target.premiumArt) ? 1 : 0),
      0,
    );
  }

  public activePrestigeCount(art?: PremiumArtKind): number {
    return this.targets.reduce((count, target) => {
      if (!target.active || !target.premiumArt || !isPrestigeArt(target.premiumArt)) return count;
      return count + (art === undefined || target.premiumArt === art ? 1 : 0);
    }, 0);
  }

  public activeCarrierDroneCount(): number {
    return this.targets.reduce(
      (count, target) => count + (target.active && target.carrierLaunched ? 1 : 0),
      0,
    );
  }

  public premiumTypesSeenCount(): number {
    return this.premiumKindsSeen.size;
  }

  public premiumTypesSeenSnapshot(): readonly PremiumArtKind[] {
    return PREMIUM_ART_KINDS.filter((art) => this.premiumKindsSeen.has(art));
  }

  public prime(target: WorldTarget, delay: number, chainDepth: number): boolean {
    if (!target.active || target.kind !== 'mine') return false;
    const newlyPrimed = !target.primed;
    target.primed = true;
    target.chainDepth = newlyPrimed ? Math.max(0, chainDepth) : Math.min(target.chainDepth, Math.max(0, chainDepth));
    target.primeTimer = newlyPrimed ? Math.max(0, delay) : Math.min(target.primeTimer, Math.max(0, delay));
    return newlyPrimed;
  }

  public split(target: WorldTarget, amount: number): number {
    const count = clamp(Math.floor(amount), 3, 5);
    const parent = {
      x: target.x,
      y: target.y,
      vx: target.vx,
      vy: target.vy,
      rotation: target.rotation,
      formationId: target.formationId,
    };
    let spawned = 0;
    const activeSlotsNeeded = Math.max(0, this.activeCount() + count - TUNING.peakActiveTargets);
    const physicalSlotsNeeded = Math.max(
      0,
      count - this.targets.reduce((total, candidate) => total + (candidate.active ? 0 : 1), 0),
    );
    this.recycleTargets(Math.max(activeSlotsNeeded, physicalSlotsNeeded), target.formationId);
    for (let index = 0; index < count; index += 1) {
      const angle = parent.rotation + index / count * Math.PI * 2;
      if (this.spawn(
        'splitterFragment',
        parent.x + Math.cos(angle) * 13,
        parent.y + Math.sin(angle) * 13,
        parent.vx * 0.35 + Math.cos(angle) * 125,
        parent.vy * 0.35 + Math.sin(angle) * 125,
        0,
        parent.formationId,
        true,
      )) spawned += 1;
    }
    return spawned;
  }

  public detonateFinalEscorts(limit: number): WorldTarget[] {
    const detonated: WorldTarget[] = [];
    for (const target of this.targets) {
      if (!target.active || !isEnemyKind(target.kind)) continue;
      target.active = false;
      detonated.push(target);
      if (detonated.length >= Math.max(0, Math.floor(limit))) break;
    }
    return detonated;
  }

  public spawnFormation(kind: FormationKind, player: PlayerState, telegraph = 0.46): number {
    const formationId = this.nextFormationId;
    this.nextFormationId += 1;
    let spawned = 0;
    const add = (
      targetKind: TargetKind,
      x: number,
      y: number,
      vx: number,
      vy: number,
      delay = telegraph,
    ): void => {
      if (this.spawn(targetKind, x, y, vx, vy, delay, formationId)) spawned += 1;
    };

    if (kind === 'wedge') {
      const center = 100 + this.random() * (STAGE.width - 200);
      const fromTop = this.random() > 0.35;
      for (let index = 0; index < 7; index += 1) {
        const row = Math.floor(index / 2);
        const side = index === 0 ? 0 : (index % 2 === 0 ? 1 : -1);
        const x = clamp(center + side * row * 31, 24, STAGE.width - 24);
        const y = fromTop ? STAGE.hudTop - 28 - row * 19 : STAGE.height + 28 + row * 19;
        add('swarmer', x, y, side * 18, fromTop ? 92 : -92, telegraph + row * 0.035);
      }
    } else if (kind === 'arc') {
      const fromLeft = this.random() > 0.5;
      for (let index = 0; index < 9; index += 1) {
        const spread = index - 4;
        add(
          'swarmer',
          fromLeft ? -26 - Math.abs(spread) * 8 : STAGE.width + 26 + Math.abs(spread) * 8,
          220 + index * 52,
          fromLeft ? 108 : -108,
          -spread * 9,
          telegraph + Math.abs(spread) * 0.025,
        );
      }
    } else if (kind === 'ring') {
      const radius = 142;
      for (let index = 0; index < 10; index += 1) {
        const angle = index / 10 * Math.PI * 2 + this.random() * 0.12;
        const x = clamp(player.x + Math.cos(angle) * radius, 24, STAGE.width - 24);
        const y = clamp(player.y + Math.sin(angle) * radius, STAGE.hudTop + 32, STAGE.height - 32);
        add('swarmer', x, y, -Math.cos(angle) * 72, -Math.sin(angle) * 72);
      }
    } else if (kind === 'spiral') {
      const centerX = 110 + this.random() * (STAGE.width - 220);
      const centerY = 230 + this.random() * 340;
      for (let index = 0; index < 10; index += 1) {
        const angle = index * 1.16;
        const radius = 28 + index * 10;
        add(
          'swarmer',
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius,
          -Math.sin(angle) * 72,
          Math.cos(angle) * 72,
          telegraph + index * 0.025,
        );
      }
    } else if (kind === 'minefield') {
      const centerX = 100 + this.random() * (STAGE.width - 200);
      const centerY = 245 + this.random() * 310;
      const positions = [[0, 0], [-42, -34], [42, -34], [-52, 34], [52, 34], [0, 68], [0, -70]];
      positions.forEach(([offsetX = 0, offsetY = 0], index) => {
        add('mine', centerX + offsetX, centerY + offsetY, 0, 0, telegraph + index * 0.025);
      });
    } else if (kind === 'splitter') {
      const fromLeft = this.random() > 0.5;
      for (let index = 0; index < 3; index += 1) {
        add('splitter', fromLeft ? -34 : STAGE.width + 34, 245 + index * 155, fromLeft ? 66 : -66, (index - 1) * 12);
      }
      for (let index = 0; index < 4; index += 1) {
        add('swarmer', fromLeft ? -28 : STAGE.width + 28, 205 + index * 126, fromLeft ? 112 : -112, 0, telegraph + 0.12);
      }
    } else {
      const centerX = 110 + this.random() * (STAGE.width - 220);
      const centerY = 245 + this.random() * 280;
      for (let index = 0; index < 5; index += 1) {
        const angle = index / 5 * Math.PI * 2;
        add('mine', centerX + Math.cos(angle) * 62, centerY + Math.sin(angle) * 62, 0, 0);
      }
      add('splitter', centerX, centerY, 22, -18, telegraph + 0.08);
      for (let index = 0; index < 6; index += 1) {
        const angle = index / 6 * Math.PI * 2 + Math.PI / 6;
        add('swarmer', centerX + Math.cos(angle) * 105, centerY + Math.sin(angle) * 105, -Math.cos(angle) * 62, -Math.sin(angle) * 62, telegraph + 0.15);
      }
    }
    return spawned;
  }

  public spawnBossEscort(stage: number, bossX: number, bossY: number, player: PlayerState): number {
    let spawned = 0;
    const formationId = this.nextFormationId;
    this.nextFormationId += 1;
    const requested = 5 + stage * 2 + 7 + stage * 2 + (stage >= 1 ? 2 : 0);
    const activeSlotsNeeded = Math.max(0, this.activeCount() + requested - TUNING.peakActiveTargets);
    const physicalSlotsNeeded = Math.max(
      0,
      requested - this.targets.reduce((total, target) => total + (target.active ? 0 : 1), 0),
    );
    this.recycleTargets(Math.max(activeSlotsNeeded, physicalSlotsNeeded), -1);
    const add = (
      kind: TargetKind,
      x: number,
      y: number,
      vx: number,
      vy: number,
      delay: number,
      premiumArt: PremiumArtKind | null = null,
    ): void => {
      const boundedArt = premiumArt && this.activePremiumCount() < TUNING.maxPremiumTargets
        ? premiumArt
        : null;
      if (this.spawn(kind, x, y, vx, vy, delay, formationId, true, boundedArt)) spawned += 1;
    };
    const mineCount = 5 + stage * 2;
    for (let index = 0; index < mineCount; index += 1) {
      const angle = index / mineCount * Math.PI * 2 + stage * 0.4;
      add(
        'mine',
        clamp(bossX + Math.cos(angle) * (105 + stage * 13), 24, STAGE.width - 24),
        clamp(bossY + Math.sin(angle) * (82 + stage * 10) + 52, STAGE.hudTop + 30, STAGE.height - 30),
        0,
        0,
        0.38 + index * 0.025,
      );
    }
    for (let index = 0; index < 7 + stage * 2; index += 1) {
      const angle = index / (7 + stage * 2) * Math.PI * 2;
      const x = clamp(player.x + Math.cos(angle) * (155 + stage * 12), 18, STAGE.width - 18);
      const y = clamp(player.y + Math.sin(angle) * (145 + stage * 10), STAGE.hudTop + 28, STAGE.height - 28);
      const premiumEscort = index === 0 || index === Math.floor((7 + stage * 2) / 2)
        ? 'alienInterceptor'
        : null;
      add('swarmer', x, y, -Math.cos(angle) * 82, -Math.sin(angle) * 82, 0.46 + index * 0.018, premiumEscort);
    }
    if (stage >= 1) {
      add('splitter', 40, 500, 72, -12, 0.58, 'alienInterceptor');
      add('splitter', STAGE.width - 40, 590, -72, 12, 0.66, 'alienInterceptor');
    }
    return spawned;
  }

  private createEmptyTarget(): WorldTarget {
    return {
      id: 0,
      kind: 'debris',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 0,
      hp: 0,
      maxHp: 0,
      mass: 0,
      score: 0,
      rotation: 0,
      spin: 0,
      hitCooldown: 0,
      coverHitCooldown: 0,
      age: 0,
      behaviorPhase: 0,
      formationId: 0,
      telegraph: 0,
      primeTimer: 0,
      primed: false,
      chainDepth: 0,
      contactDamage: 0,
      premiumArt: null,
      impactFlash: 0,
      damageMask: 0,
      launchTimer: 0,
      launchedCount: 0,
      carrierLaunched: false,
      active: false,
    };
  }

  private spawnOpeningCascade(player: PlayerState): void {
    const formationId = this.nextFormationId;
    this.nextFormationId += 1;
    this.spawn('satellite', player.x, player.y - 96, 0, 18, 0, formationId);
    const positions = [
      [0, -190], [-31, -214], [31, -214], [-61, -238], [61, -238], [-91, -262], [91, -262],
    ];
    positions.forEach(([offsetX = 0, offsetY = 0], index) => {
      this.spawn('swarmer', clamp(player.x + offsetX, 20, STAGE.width - 20), player.y + offsetY, 0, 42, index * 0.025, formationId);
    });
    const mineY = player.y - 335;
    const decisionSide = this.runSeed % 2 === 0 ? -1 : 1;
    [-42, 0, 42].forEach((offsetX, index) => {
      this.spawn(
        'mine',
        clamp(player.x + decisionSide * 96 + offsetX, 24, STAGE.width - 24),
        mineY + Math.abs(index - 1) * 22,
        0,
        0,
        0.18,
        formationId,
      );
    });
    this.spawn('debris', player.x - 80, player.y - 135, 24, -8, 0, formationId);
    this.spawn('debris', player.x + 82, player.y - 152, -22, 4, 0, formationId);
    this.ensurePremiumTargets(player, 0);
  }

  private updateTargetBehavior(target: WorldTarget, player: PlayerState, delta: number, pressure: number): void {
    if (target.kind === 'swarmer' || target.kind === 'splitterFragment') {
      const dx = player.x - target.x;
      const dy = player.y - target.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const acceleration = (target.kind === 'splitterFragment' ? 92 : 58) * pressure;
      target.vx += dx / distance * acceleration * delta;
      target.vy += dy / distance * acceleration * delta;
      const maxSpeed = (target.kind === 'splitterFragment' ? 178 : 132) * pressure;
      const speed = Math.hypot(target.vx, target.vy);
      if (speed > maxSpeed) {
        target.vx *= maxSpeed / speed;
        target.vy *= maxSpeed / speed;
      }
    } else if (target.kind === 'splitter') {
      target.vy += Math.sin(target.age * 2.1 + target.behaviorPhase) * 5 * delta;
    } else if (target.kind === 'mine') {
      target.vx *= Math.pow(0.985, delta * 60);
      target.vy *= Math.pow(0.985, delta * 60);
    }
  }

  private spawnAscentWave(): void {
    const kinds: TargetKind[][] = [
      ['balloon', 'instrument'],
      ['aircraft'],
      ['instrument', 'debris', 'debris'],
    ];
    const wave = kinds[this.ascentWave % kinds.length] ?? ['instrument'];
    wave.forEach((kind, index) => {
      const spread = (index - (wave.length - 1) / 2) * 54;
      this.spawn(kind, STAGE.width / 2 + spread + (this.random() - 0.5) * 105, -45 - index * 18, (this.random() - 0.5) * 18, 15, 0, 0);
    });
    this.ascentWave += 1;
    this.spawnTimer = 0.78 + this.random() * 0.16;
  }

  private replenishArena(player: PlayerState, phaseTime: number, overdrive: number): void {
    this.spawnIntensity = clamp(0.28 + phaseTime / TUNING.orbitDuration * 0.72 + overdrive * 0.32, 0, 1.22);
    const densityStage = Math.min(4, Math.floor(phaseTime / 12));
    const surge = phaseTime % 12 >= 8.5;
    const desired = Math.min(
      TUNING.peakActiveTargets,
      17 + densityStage * 2 + Math.round(overdrive * 4) + (surge ? 12 : 0),
    );
    this.ensurePrestigeTarget(phaseTime);
    this.ensurePremiumTargets(player, phaseTime);
    if (this.activeCount() < desired) {
      const sequence: FormationKind[] = ['wedge', 'minefield', 'arc', 'splitter', 'spiral', 'mixed', 'ring'];
      const kind = sequence[this.formationCursor % sequence.length] ?? 'wedge';
      this.formationCursor += 1 + (this.random() > 0.82 ? 1 : 0);
      this.spawnFormation(kind, player);
      if (this.activeCount() < desired - 8 && phaseTime > 18) this.spawnFormation('wedge', player, 0.58);
    }
    this.spawnTimer = clamp(1.48 - this.spawnIntensity * 0.28, 1.08, 1.42);
  }

  private replenishBoss(player: PlayerState, phaseTime: number, bossPhase: number, overdrive: number): void {
    const pressureRamp = clamp(phaseTime / TUNING.bossPressureRampSeconds, 0, 1);
    this.spawnIntensity = clamp(0.72 + bossPhase * 0.14 + pressureRamp * 0.34 + overdrive * 0.16, 0, 1.35);
    const desired = Math.min(
      TUNING.peakActiveTargets,
      22 + bossPhase * 4 + Math.round(pressureRamp * 8) + Math.round(overdrive * 3),
    );
    this.ensurePremiumTargets(player, phaseTime, true);
    if (this.activeCount() < desired) {
      const sequence: FormationKind[] = bossPhase >= 2
        ? ['minefield', 'mixed', 'ring']
        : ['arc', 'wedge', 'splitter', 'minefield'];
      const kind = sequence[this.formationCursor % sequence.length] ?? 'mixed';
      this.formationCursor += 1;
      this.spawnFormation(kind, player, 0.4);
    }
    this.spawnTimer = clamp(1.15 - bossPhase * 0.08 - pressureRamp * 0.25 - overdrive * 0.1, 0.72, 1.15);
  }

  private spawn(
    kind: TargetKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    telegraph: number,
    formationId: number,
    mandatory = false,
    premiumArt: PremiumArtKind | null = null,
  ): WorldTarget | null {
    if (!mandatory && this.activeCount() >= TUNING.peakActiveTargets) {
      this.droppedSpawns += 1;
      return null;
    }
    if (isEnemyKind(kind) && this.activeEnemyCount() >= TUNING.maxEnemies) {
      this.droppedSpawns += 1;
      return null;
    }
    const target = this.targets.find((candidate) => !candidate.active);
    if (!target) {
      this.droppedSpawns += 1;
      return null;
    }
    const profile = PROFILES[kind];
    Object.assign(target, {
      id: this.nextId,
      kind,
      x,
      y,
      vx,
      vy,
      radius: profile.radius,
      hp: profile.hp,
      maxHp: profile.hp,
      mass: profile.mass,
      score: profile.score,
      rotation: this.random() * Math.PI * 2,
      spin: (this.random() - 0.5) * (kind === 'mine' ? 1.4 : 3.4),
      hitCooldown: 0,
      coverHitCooldown: 0,
      age: 0,
      behaviorPhase: this.random() * Math.PI * 2,
      formationId,
      telegraph,
      primeTimer: 0,
      primed: false,
      chainDepth: 0,
      contactDamage: profile.contactDamage,
      premiumArt,
      impactFlash: 0,
      damageMask: 0,
      launchTimer: kind === 'carrier' ? 1.05 : 0,
      launchedCount: 0,
      carrierLaunched: false,
      active: true,
    });
    const visualArt = targetVisualArt(kind, premiumArt);
    if (visualArt) this.premiumKindsSeen.add(visualArt);
    if (kind === 'yacht' || kind === 'datacenter' || kind === 'carrier') {
      target.spin *= 0.18;
    }
    this.nextId += 1;
    return target;
  }

  private recycleTargets(amount: number, protectedFormationId: number): void {
    let remaining = Math.max(0, Math.floor(amount));
    if (remaining <= 0) return;
    const candidates = this.targets
      .filter((target) => target.active && target.formationId !== protectedFormationId)
      .sort((left, right) => {
        const leftPriority = left.kind === 'debris' || left.kind === 'satellite' || left.kind === 'solar' ? 0 : 1;
        const rightPriority = right.kind === 'debris' || right.kind === 'satellite' || right.kind === 'solar' ? 0 : 1;
        return leftPriority - rightPriority || right.age - left.age;
      });
    for (const target of candidates) {
      target.active = false;
      remaining -= 1;
      if (remaining <= 0) break;
    }
  }

  private ensurePremiumTargets(player: PlayerState, phaseTime: number, boss = false): void {
    const desired = clamp(
      TUNING.minPremiumTargets + Math.floor(phaseTime / 16) + (boss ? 1 : 0),
      TUNING.minPremiumTargets,
      TUNING.maxPremiumTargets,
    );
    const activeAmbient = this.targets.reduce((count, target) => count + (
      target.active && target.premiumArt && PREMIUM_ASSETS[target.premiumArt].role === 'ambient' ? 1 : 0
    ), 0);
    let missing = desired - activeAmbient;
    while (missing > 0 && this.activeCount() < TUNING.peakActiveTargets
      && this.activePremiumCount() < TUNING.maxPremiumTargets) {
      const art = this.ambientDeck.draw();
      const kind = premiumGameplayKind(art);
      const edge = this.nextFormationId % 4;
      const margin = kind === 'solar' ? 48 : 38;
      const x = edge === 0
        ? -margin
        : edge === 1
          ? STAGE.width + margin
          : 58 + this.random() * (STAGE.width - 116);
      const y = edge === 2
        ? STAGE.hudTop - margin
        : edge === 3
          ? STAGE.height + margin
          : 160 + this.random() * 470;
      const dx = player.x - x;
      const dy = player.y - y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const speed = art === 'alienInterceptor' ? 72 : 24 + this.random() * 20;
      const target = this.spawn(
        kind,
        x,
        y,
        dx / distance * speed,
        dy / distance * speed,
        0.34 + this.random() * 0.18,
        this.nextFormationId++,
        false,
        art,
      );
      if (!target) break;
      missing -= 1;
    }
  }

  private ensurePrestigeTarget(phaseTime: number): void {
    const dueTime = TUNING.prestigeSpawnTimes[this.prestigeSpawnIndex];
    if (dueTime === undefined || phaseTime < dueTime || this.activePrestigeCount() >= TUNING.maxPrestigeTargets) return;
    const art = this.prestigeDeck.draw();
    if (this.activePrestigeCount(art) > 0) return;
    if (this.activeCount() >= TUNING.peakActiveTargets) this.recycleTargets(1, -1);
    const kind = premiumGameplayKind(art);
    const fromLeft = this.random() > 0.5;
    const x = kind === 'carrier' ? STAGE.width / 2 : fromLeft ? -62 : STAGE.width + 62;
    const y = kind === 'carrier' ? 176 : 180 + this.random() * 350;
    const vx = kind === 'datacenter' ? (fromLeft ? 17 : -17) : kind === 'yacht' ? (fromLeft ? 38 : -38) : 0;
    const vy = kind === 'carrier' ? 7 : (this.random() - 0.5) * 15;
    const target = this.spawn(
      kind,
      x,
      y,
      vx,
      vy,
      0.62,
      this.nextFormationId++,
      true,
      art,
    );
    if (!target) return;
    if (kind === 'carrier') target.rotation = 0;
    if (kind === 'yacht') target.rotation = fromLeft ? -0.1 : Math.PI - 0.1;
    this.prestigeSpawnIndex += 1;
  }

  private launchCarrierDrones(player: PlayerState): void {
    let activeCarrierDrones = this.activeCarrierDroneCount();
    if (activeCarrierDrones >= TUNING.maxCarrierDrones) return;
    for (const carrier of this.targets) {
      if (!carrier.active || carrier.kind !== 'carrier' || carrier.telegraph > 0 || carrier.launchTimer > 0) continue;
      if (carrier.launchedCount >= TUNING.maxCarrierLaunches) continue;
      const intactBays = [0, 1].filter((bay) => (carrier.damageMask & (1 << bay)) === 0);
      if (intactBays.length === 0) continue;
      const launchCount = Math.min(
        intactBays.length,
        TUNING.maxCarrierDrones - activeCarrierDrones,
        TUNING.maxCarrierLaunches - carrier.launchedCount,
      );
      for (let index = 0; index < launchCount; index += 1) {
        const bay = intactBays[index];
        if (bay === undefined) continue;
        const side = bay === 0 ? -1 : 1;
        const dx = player.x - (carrier.x + side * 27);
        const dy = player.y - (carrier.y + 13);
        const distance = Math.max(1, Math.hypot(dx, dy));
        const drone = this.spawn(
          'swarmer',
          carrier.x + side * 27,
          carrier.y + 13,
          carrier.vx + dx / distance * 118,
          carrier.vy + dy / distance * 118,
          0.16 + index * 0.06,
          carrier.formationId,
        );
        if (!drone) continue;
        drone.carrierLaunched = true;
        carrier.launchedCount += 1;
        activeCarrierDrones += 1;
      }
      carrier.launchTimer = intactBays.length > 1 ? 1.35 : 2.1;
      if (activeCarrierDrones >= TUNING.maxCarrierDrones) return;
    }
  }

  private applyGalleryDamage(target: WorldTarget): void {
    const art = target.premiumArt;
    if (!art) return;
    const subsystemCount = prestigeSubsystemCount(art);
    if (subsystemCount > 0) {
      const damagedCount = Math.min(2, subsystemCount);
      target.damageMask = (1 << damagedCount) - 1;
      target.hp = Math.max(1, target.maxHp - damagedCount);
    } else if (target.maxHp > 1) {
      target.damageMask = 1;
      target.hp = Math.max(1, target.maxHp - 1);
    }
    if (target.kind === 'mine') {
      target.primed = true;
      target.primeTimer = 9;
    }
    target.impactFlash = 0.72;
  }

  private random(): number {
    const value = seededNoise(this.randomSeed);
    this.randomSeed += 1;
    return value;
  }
}
