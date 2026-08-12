export type GamePhase =
  | 'boot'
  | 'title'
  | 'hint'
  | 'launch'
  | 'ascent'
  | 'orbit'
  | 'boss'
  | 'results';

export type FlightPhase = 'ascent' | 'orbit' | 'boss';
export type Outcome = 'victory' | 'failure';
export type UpgradeKey = 'launchPressure' | 'reinforcedCover' | 'magneticRim';
export type TargetKind =
  | 'balloon'
  | 'instrument'
  | 'aircraft'
  | 'satellite'
  | 'solar'
  | 'debris'
  | 'swarmer'
  | 'mine'
  | 'splitter'
  | 'splitterFragment';
export type FormationKind = 'wedge' | 'arc' | 'ring' | 'spiral' | 'minefield' | 'splitter' | 'mixed';
export type DamageSource = 'cover' | 'halo' | 'shockwave' | 'burst' | 'mine';
export type HaloTier = 0 | 1 | 2 | 3 | 4;
export type ExplosionTier = 'spark' | 'burst' | 'cascade' | 'catastrophe';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState extends Vec2 {
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  integrity: number;
  maxIntegrity: number;
  heat: number;
  stalledFor: number;
  burstSafetyTimer: number;
}

export interface WorldTarget extends Vec2 {
  id: number;
  kind: TargetKind;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  mass: number;
  score: number;
  rotation: number;
  spin: number;
  hitCooldown: number;
  coverHitCooldown: number;
  age: number;
  behaviorPhase: number;
  formationId: number;
  telegraph: number;
  primeTimer: number;
  primed: boolean;
  chainDepth: number;
  contactDamage: number;
  active: boolean;
}

export interface GravityWell extends Vec2 {
  radius: number;
  strength: number;
  phase: number;
}

export interface HaloOrbiter {
  active: boolean;
  angle: number;
  angularVelocity: number;
  distanceFactor: number;
  size: number;
  shape: number;
  brightness: number;
  band: number;
}

export interface BossWeakPoint extends Vec2 {
  index: number;
  offsetX: number;
  offsetY: number;
  hp: number;
  maxHp: number;
  active: boolean;
  vulnerable: boolean;
  flash: number;
}

export interface BossState {
  active: boolean;
  destroyed: boolean;
  entrance: number;
  x: number;
  y: number;
  vx: number;
  hp: number;
  maxHp: number;
  contactCooldown: number;
  flash: number;
  timeRemaining: number;
  droneAngle: number;
  phase: number;
  weakPoints: BossWeakPoint[];
}

export interface GameplayWave extends Vec2 {
  active: boolean;
  id: number;
  previousRadius: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  damage: number;
  depth: number;
  source: DamageSource;
  hitTargetIds: number[];
}

export interface BurstShard extends Vec2 {
  active: boolean;
  id: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  penetration: number;
  hitTargetIds: number[];
}

export interface Particle extends Vec2 {
  active: boolean;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
}

export interface Shockwave extends Vec2 {
  active: boolean;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export interface EffectLink {
  active: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface ImpactText extends Vec2 {
  active: boolean;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
}

export interface RunStats {
  maximumVelocity: number;
  objectsDestroyed: number;
  largestCombo: number;
  wreckageMass: number;
  totalScore: number;
  scrapEarned: number;
  mothershipDestroyed: boolean;
  elapsedSeconds: number;
}

export interface PersistedState {
  version: 1;
  bestScore: number;
  scrap: number;
  seenHint: boolean;
  muted: boolean;
  volume: number;
  upgrades: Record<UpgradeKey, number>;
}

export interface DebugSnapshot {
  fps: number;
  phase: GamePhase;
  phaseTime: number;
  elapsed: number;
  velocityX: number;
  velocityY: number;
  playerX: number;
  playerY: number;
  bossPhase: number;
  weakPointX: number;
  weakPointY: number;
  targets: number;
  enemies: number;
  particles: number;
  shockwaves: number;
  gameplayWaves: number;
  burstShards: number;
  haloOrbiters: number;
  haloTier: HaloTier;
  burstCharge: number;
  overdrive: number;
  spawnIntensity: number;
  runSeed: number;
  peakTargets: number;
  droppedSpawns: number;
  comboCount: number;
  largestCombo: number;
  comboTimer: number;
  maximumMass: number;
}
