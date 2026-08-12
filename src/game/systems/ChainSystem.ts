import { STAGE, TUNING } from '../config';
import type { BurstShard, DamageSource, GameplayWave } from '../types';

export class ChainSystem {
  public readonly waves: GameplayWave[];
  public readonly shards: BurstShard[];
  public droppedWaves = 0;
  private nextWaveId = 1;
  private nextShardId = 1;

  public constructor() {
    this.waves = Array.from({ length: TUNING.maxGameplayWaves }, () => ({
      active: false,
      id: 0,
      x: 0,
      y: 0,
      previousRadius: 0,
      radius: 0,
      maxRadius: 0,
      life: 0,
      maxLife: 0,
      damage: 0,
      depth: 0,
      source: 'shockwave' as DamageSource,
      hitTargetIds: [],
    }));
    this.shards = Array.from({ length: TUNING.maxBurstShards }, () => ({
      active: false,
      id: 0,
      x: 0,
      y: 0,
      previousX: 0,
      previousY: 0,
      vx: 0,
      vy: 0,
      radius: 4,
      life: 0,
      penetration: 0,
      hitTargetIds: [],
    }));
  }

  public reset(): void {
    for (const wave of this.waves) wave.active = false;
    for (const shard of this.shards) shard.active = false;
    this.nextWaveId = 1;
    this.nextShardId = 1;
    this.droppedWaves = 0;
  }

  public update(delta: number): void {
    for (const wave of this.waves) {
      if (!wave.active) continue;
      wave.life -= delta;
      if (wave.life <= 0) {
        wave.active = false;
        continue;
      }
      wave.previousRadius = wave.radius;
      const progress = 1 - wave.life / wave.maxLife;
      wave.radius = wave.maxRadius * (1 - (1 - progress) ** 2);
    }

    for (const shard of this.shards) {
      if (!shard.active) continue;
      shard.life -= delta;
      if (shard.life <= 0 || shard.penetration <= 0) {
        shard.active = false;
        continue;
      }
      shard.previousX = shard.x;
      shard.previousY = shard.y;
      shard.x += shard.vx * delta;
      shard.y += shard.vy * delta;
      if (shard.x < -45 || shard.x > STAGE.width + 45 || shard.y < STAGE.hudTop - 55 || shard.y > STAGE.height + 45) {
        shard.active = false;
      }
    }
  }

  public emitWave(
    x: number,
    y: number,
    maxRadius: number,
    damage: number,
    depth: number,
    source: DamageSource,
  ): GameplayWave | null {
    const wave = this.waves.find((candidate) => !candidate.active)
      ?? (source === 'burst' || source === 'mine'
        ? this.waves.reduce((oldest, candidate) => candidate.life < oldest.life ? candidate : oldest)
        : null);
    if (!wave) {
      this.droppedWaves += 1;
      return null;
    }
    const life = 0.32 + Math.min(0.16, maxRadius / 900);
    Object.assign(wave, {
      active: true,
      id: this.nextWaveId,
      x,
      y,
      previousRadius: 0,
      radius: 0,
      maxRadius,
      life,
      maxLife: life,
      damage,
      depth: Math.min(12, Math.max(0, depth)),
      source,
    });
    wave.hitTargetIds.length = 0;
    this.nextWaveId += 1;
    return wave;
  }

  public fireBurst(x: number, y: number, count: number, angleOffset: number): number {
    const boundedCount = Math.min(TUNING.maxBurstShards, Math.max(0, Math.floor(count)));
    let activated = 0;
    for (let index = 0; index < boundedCount; index += 1) {
      const shard = this.shards.find((candidate) => !candidate.active);
      if (!shard) break;
      const angle = angleOffset + index / boundedCount * Math.PI * 2;
      const speed = TUNING.coreBurstShardSpeed * (0.9 + (index % 3) * 0.05);
      Object.assign(shard, {
        active: true,
        id: this.nextShardId,
        x,
        y,
        previousX: x,
        previousY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 4,
        life: TUNING.coreBurstShardLife,
        penetration: 3,
      });
      shard.hitTargetIds.length = 0;
      this.nextShardId += 1;
      activated += 1;
    }
    return activated;
  }

  public activeWaveCount(): number {
    return this.waves.reduce((count, wave) => count + (wave.active ? 1 : 0), 0);
  }

  public activeShardCount(): number {
    return this.shards.reduce((count, shard) => count + (shard.active ? 1 : 0), 0);
  }
}
