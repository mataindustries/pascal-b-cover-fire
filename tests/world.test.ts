import { describe, expect, it } from 'vitest';
import { STAGE, TUNING } from '../src/game/config';
import { WorldSystem } from '../src/game/systems/WorldSystem';
import type { PlayerState } from '../src/game/types';

const player = (): PlayerState => ({
  x: STAGE.width / 2,
  y: 620,
  previousX: STAGE.width / 2,
  previousY: 620,
  vx: 0,
  vy: -400,
  radius: TUNING.playerRadius,
  rotation: 0,
  integrity: 100,
  maxIntegrity: 100,
  heat: 0,
  stalledFor: 0,
  burstSafetyTimer: 0,
});

describe('bounded formation world', () => {
  it('caps Splitter children and all active targets', () => {
    const world = new WorldSystem();
    const cover = player();
    world.reset(57);
    world.spawnFormation('splitter', cover, 0);
    const splitter = world.targets.find((target) => target.active && target.kind === 'splitter');
    expect(splitter).toBeDefined();
    if (!splitter) return;

    expect(splitter.maxHp).toBe(2);
    const parentX = splitter.x;
    const parentY = splitter.y;
    splitter.active = false;
    expect(world.split(splitter, 99)).toBe(5);
    const fragments = world.targets.filter((target) => target.active && target.kind === 'splitterFragment');
    expect(fragments).toHaveLength(5);
    expect(fragments.every((fragment) => Number.isFinite(fragment.x) && Number.isFinite(fragment.vx))).toBe(true);
    const centerX = fragments.reduce((total, fragment) => total + fragment.x, 0) / fragments.length;
    const centerY = fragments.reduce((total, fragment) => total + fragment.y, 0) / fragments.length;
    expect(centerX).toBeCloseTo(parentX, 5);
    expect(centerY).toBeCloseTo(parentY, 5);
    for (let index = 0; index < 20; index += 1) world.spawnFormation('mixed', cover, 0);
    expect(world.activeCount()).toBeLessThanOrEqual(TUNING.peakActiveTargets);
    expect(world.activeEnemyCount()).toBeLessThanOrEqual(TUNING.maxEnemies);
  });

  it('fully clears pool state and changes deterministic run seeds on restart', () => {
    const world = new WorldSystem();
    const cover = player();
    world.reset(100);
    world.enterOrbit(cover);
    expect(world.activeCount()).toBeGreaterThan(0);

    world.reset(101);
    expect(world.activeCount()).toBe(0);
    expect(world.runSeed).toBe(101);
    expect(world.peakActive).toBe(0);
    expect(world.droppedSpawns).toBe(0);
  });

  it('reserves bounded slots for mandatory Splitter payloads at peak density', () => {
    const world = new WorldSystem();
    const cover = player();
    world.reset(301);
    for (let index = 0; index < 20; index += 1) world.spawnFormation('mixed', cover, 0);
    expect(world.activeCount()).toBe(TUNING.peakActiveTargets);
    const splitter = world.targets.find((target) => target.active && target.kind === 'splitter');
    expect(splitter).toBeDefined();
    if (!splitter) return;
    splitter.active = false;
    expect(world.split(splitter, 5)).toBe(5);
    expect(world.targets.filter((target) => target.active && target.kind === 'splitterFragment')).toHaveLength(5);
    expect(world.activeCount()).toBeLessThanOrEqual(TUNING.peakActiveTargets);
  });

  it('keeps halo and direct-cover collision debounces independent', () => {
    const world = new WorldSystem();
    world.reset(401);
    const splitter = world.spawnTargetForTest('splitter', 225, 400);
    expect(splitter).not.toBeNull();
    if (!splitter) return;
    splitter.hitCooldown = 0.2;
    splitter.coverHitCooldown = 0;
    expect(splitter.hitCooldown).toBeGreaterThan(0);
    expect(splitter.coverHitCooldown).toBe(0);
    splitter.coverHitCooldown = 0.22;
    world.update(1 / 60, 'orbit', player(), 0);
    expect(splitter.hp).toBe(2);
    expect(splitter.coverHitCooldown).toBeGreaterThan(0);
  });

  it('keeps a deterministic five-to-eight ambient premium mixture mapped onto existing rules', () => {
    const first = new WorldSystem();
    const second = new WorldSystem();
    const cover = player();
    first.reset(707);
    second.reset(707);
    first.enterOrbit(cover);
    second.enterOrbit(cover);

    const firstMapping = first.targets
      .filter((target) => target.active && target.premiumArt)
      .map((target) => `${target.id}:${target.kind}:${target.premiumArt}`);
    const secondMapping = second.targets
      .filter((target) => target.active && target.premiumArt)
      .map((target) => `${target.id}:${target.kind}:${target.premiumArt}`);
    expect(firstMapping).toEqual(secondMapping);
    expect(first.activePremiumCount()).toBeGreaterThanOrEqual(TUNING.minPremiumTargets);
    expect(first.activePremiumCount()).toBeLessThanOrEqual(TUNING.maxPremiumTargets);
    expect(first.activeTexturedCount() / first.activeCount()).toBeGreaterThanOrEqual(0.7);

    const depot = first.spawnPremiumTargetForTest('fuelDepot', 100, 100);
    const station = first.spawnPremiumTargetForTest('solarPowerStation', 140, 100);
    const interceptor = first.spawnPremiumTargetForTest('alienInterceptor', 180, 100);
    expect(depot?.kind).toBe('mine');
    expect(station?.kind).toBe('solar');
    expect(interceptor?.kind).toBe('splitter');
  });

  it('keeps common replacement profiles mechanically identical to their geometric predecessors', () => {
    const mappings = [
      ['swarmer', 'hunterDrone'],
      ['mine', 'antimatterReactorPod'],
      ['splitter', 'shieldedCargoDrone'],
    ] as const;
    for (const [kind, art] of mappings) {
      const plainWorld = new WorldSystem();
      const artWorld = new WorldSystem();
      plainWorld.reset(812);
      artWorld.reset(812);
      const plain = plainWorld.spawnTargetForTest(kind, 100, 120, 9, -7);
      const textured = artWorld.spawnPremiumTargetForTest(art, 100, 120);
      expect(plain).not.toBeNull();
      expect(textured).not.toBeNull();
      if (!plain || !textured) continue;
      expect(textured).toMatchObject({
        kind: plain.kind,
        radius: plain.radius,
        hp: plain.hp,
        maxHp: plain.maxHp,
        mass: plain.mass,
        score: plain.score,
        contactDamage: plain.contactDamage,
      });
    }
  });

  it('guarantees at least eight premium body types in a complete seeded arena run', () => {
    const world = new WorldSystem();
    const cover = player();
    world.reset(1_957);
    world.enterOrbit(cover);
    for (let step = 1; step <= 60 * 60; step += 1) {
      world.update(1 / 60, 'orbit', cover, step / 60, 0.45);
      expect(world.activePrestigeCount()).toBeLessThanOrEqual(TUNING.maxPrestigeTargets);
    }
    expect(world.premiumTypesSeenCount()).toBeGreaterThanOrEqual(8);
    for (const art of ['luxurySpaceYacht', 'orbitalDatacenter', 'crownDroneCarrier'] as const) {
      expect(world.activePrestigeCount(art)).toBeLessThanOrEqual(1);
    }
  });

  it('caps carrier-launched Hunter Drones, prevents recursion, and clears them on reset', () => {
    const world = new WorldSystem();
    const cover = player();
    world.reset(4_404);
    const carrier = world.spawnPremiumTargetForTest('crownDroneCarrier', STAGE.width / 2, 220);
    expect(carrier).not.toBeNull();
    for (let step = 1; step <= 60 * 20; step += 1) {
      world.update(1 / 60, 'orbit', cover, step / 60, 0.2);
      expect(world.activeCarrierDroneCount()).toBeLessThanOrEqual(TUNING.maxCarrierDrones);
    }
    expect(carrier?.launchedCount).toBeLessThanOrEqual(TUNING.maxCarrierLaunches);
    expect(world.targets.filter((target) => target.active && target.carrierLaunched)
      .every((target) => target.kind === 'swarmer' && target.launchedCount === 0)).toBe(true);

    world.reset(4_405);
    expect(world.activeCarrierDroneCount()).toBe(0);
    expect(world.targets.every((target) => !target.active && !target.carrierLaunched)).toBe(true);
  });

  it('hard-caps premium art through repeated mandatory boss escort waves', () => {
    const world = new WorldSystem();
    const cover = player();
    world.reset(909);
    world.enterBoss(cover);
    for (let stage = 0; stage < 8; stage += 1) {
      world.spawnBossEscort(stage % 3, STAGE.width / 2, 230, cover);
      expect(world.activePremiumCount()).toBeLessThanOrEqual(TUNING.maxPremiumTargets);
    }
  });
});
