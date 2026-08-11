import { STAGE, TUNING } from '../config';
import { seededNoise } from '../math';
import type { FlightPhase, GravityWell, TargetKind, WorldTarget } from '../types';

interface TargetProfile {
  radius: number;
  hp: number;
  mass: number;
  score: number;
}

const PROFILES: Record<TargetKind, TargetProfile> = {
  balloon: { radius: 19, hp: 1, mass: 0.7, score: 120 },
  instrument: { radius: 12, hp: 1, mass: 0.9, score: 160 },
  aircraft: { radius: 25, hp: 1, mass: 1.4, score: 260 },
  satellite: { radius: 18, hp: 1, mass: 1.8, score: 310 },
  solar: { radius: 25, hp: 1, mass: 2.1, score: 380 },
  tank: { radius: 23, hp: 2, mass: 3.2, score: 580 },
  antenna: { radius: 17, hp: 1, mass: 1.6, score: 290 },
  asteroid: { radius: 23, hp: 2, mass: 3.8, score: 620 },
  debris: { radius: 9, hp: 1, mass: 0.55, score: 90 },
  drone: { radius: 14, hp: 1, mass: 1.5, score: 420 },
};

const orbitKinds: TargetKind[] = ['satellite', 'solar', 'tank', 'antenna', 'asteroid', 'debris'];

export class WorldSystem {
  public readonly targets: WorldTarget[];
  public readonly gravityWells: GravityWell[] = [];
  private nextId = 1;
  private spawnTimer = 0;
  private ascentWave = 0;
  private randomSeed = 10;

  public constructor() {
    this.targets = Array.from({ length: TUNING.maxWorldObjects }, () => ({
      id: 0,
      kind: 'debris' as TargetKind,
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
      active: false,
    }));
  }

  public reset(): void {
    for (const target of this.targets) target.active = false;
    this.gravityWells.length = 0;
    this.nextId = 1;
    this.spawnTimer = 0;
    this.ascentWave = 0;
    this.randomSeed = 10;
  }

  public startAscent(): void {
    for (const target of this.targets) target.active = false;
    this.gravityWells.length = 0;
    this.spawnTimer = 0.8;
    this.ascentWave = 0;
  }

  public enterOrbit(): void {
    for (const target of this.targets) target.active = false;
    this.gravityWells.length = 0;
    this.gravityWells.push(
      { x: 92, y: 276, radius: 104, strength: 12_500, phase: 0.2 },
      { x: 362, y: 566, radius: 116, strength: 14_500, phase: 2.1 },
    );
    this.spawnTimer = 1.2;
    for (let index = 0; index < 16; index += 1) {
      const lane = index % 4;
      const kind = orbitKinds[index % orbitKinds.length] ?? 'debris';
      this.spawn(
        kind,
        55 + lane * 112 + (seededNoise(index + 4) - 0.5) * 54,
        115 + Math.floor(index / 4) * 172 + (seededNoise(index + 8) - 0.5) * 74,
        (seededNoise(index + 14) - 0.5) * 34,
        22 + seededNoise(index + 20) * 34,
      );
    }
  }

  public enterBoss(): void {
    for (const target of this.targets) target.active = false;
    this.gravityWells.length = 0;
    this.gravityWells.push({ x: STAGE.width / 2, y: 245, radius: 132, strength: 18_500, phase: 0 });
    this.spawnTimer = 0.6;
    for (let index = 0; index < 6; index += 1) this.spawnBossDrone(index);
  }

  public update(delta: number, phase: FlightPhase, ascentSpeed = 0): void {
    for (const well of this.gravityWells) well.phase += delta;
    for (const target of this.targets) {
      if (!target.active) continue;
      target.hitCooldown = Math.max(0, target.hitCooldown - delta);
      target.rotation += target.spin * delta;
      target.x += target.vx * delta;
      target.y += (target.vy + (phase === 'ascent' ? ascentSpeed : 0)) * delta;

      if (phase === 'ascent') {
        if (target.y > STAGE.height + 70) target.active = false;
      } else {
        if (target.x < -80) target.x = STAGE.width + 70;
        if (target.x > STAGE.width + 80) target.x = -70;
        if (target.y > STAGE.height + 80) target.y = -70;
        if (target.y < -90) target.y = STAGE.height + 70;
      }
    }

    this.spawnTimer -= delta;
    if (phase === 'ascent' && this.spawnTimer <= 0) this.spawnAscentWave();
    if (phase === 'orbit' && this.spawnTimer <= 0) this.replenishOrbit();
    if (phase === 'boss' && this.spawnTimer <= 0) this.replenishDrones();
  }

  public activeCount(): number {
    return this.targets.reduce((count, target) => count + (target.active ? 1 : 0), 0);
  }

  public spawnBossDrone(index: number): void {
    const angle = index / 6 * Math.PI * 2;
    const radius = 118 + (index % 2) * 24;
    this.spawn(
      'drone',
      STAGE.width / 2 + Math.cos(angle) * radius,
      230 + Math.sin(angle) * radius * 0.58,
      Math.sin(angle) * 25,
      -Math.cos(angle) * 18,
    );
  }

  private spawnAscentWave(): void {
    const kinds: TargetKind[][] = [
      ['balloon'],
      ['instrument', 'instrument'],
      ['aircraft'],
      ['balloon', 'instrument'],
      ['debris', 'debris', 'debris'],
    ];
    const wave = kinds[this.ascentWave % kinds.length] ?? ['instrument'];
    wave.forEach((kind, index) => {
      const spread = (index - (wave.length - 1) / 2) * 56;
      const noise = (this.random() - 0.5) * 155;
      this.spawn(kind, STAGE.width / 2 + spread + noise, -50 - index * 24, (this.random() - 0.5) * 22, 15);
    });
    this.ascentWave += 1;
    this.spawnTimer = 2.1 + this.random() * 0.65;
  }

  private replenishOrbit(): void {
    if (this.activeCount() < 22) {
      const amount = 2 + Math.floor(this.random() * 3);
      for (let index = 0; index < amount; index += 1) {
        const kind = orbitKinds[Math.floor(this.random() * orbitKinds.length)] ?? 'debris';
        const edge = Math.floor(this.random() * 3);
        const x = edge === 0 ? -35 : edge === 1 ? STAGE.width + 35 : 35 + this.random() * (STAGE.width - 70);
        const y = edge === 2 ? -35 : 100 + this.random() * 620;
        this.spawn(kind, x, y, (this.random() - 0.5) * 64, 18 + this.random() * 52);
      }
    }
    this.spawnTimer = 1.35 + this.random() * 0.8;
  }

  private replenishDrones(): void {
    const drones = this.targets.reduce(
      (count, target) => count + (target.active && target.kind === 'drone' ? 1 : 0),
      0,
    );
    if (drones < 4) this.spawnBossDrone(Math.floor(this.random() * 6));
    this.spawnTimer = 2.6;
  }

  private spawn(kind: TargetKind, x: number, y: number, vx: number, vy: number): WorldTarget | null {
    const target = this.targets.find((candidate) => !candidate.active);
    if (!target) return null;
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
      spin: (this.random() - 0.5) * 2.8,
      hitCooldown: 0,
      active: true,
    });
    this.nextId += 1;
    return target;
  }

  private random(): number {
    const value = seededNoise(this.randomSeed);
    this.randomSeed += 1;
    return value;
  }
}
