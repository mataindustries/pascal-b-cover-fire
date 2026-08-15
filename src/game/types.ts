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
export type PremiumArtKind =
  | 'communicationsSatellite'
  | 'goldTelescope'
  | 'fuelDepot'
  | 'solarPowerStation'
  | 'observationModule'
  | 'alienInterceptor'
  | 'hunterDrone'
  | 'antimatterReactorPod'
  | 'shieldedCargoDrone'
  | 'luxurySpaceYacht'
  | 'orbitalDatacenter'
  | 'crownDroneCarrier';
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
  | 'splitterFragment'
  | 'yacht'
  | 'datacenter'
  | 'carrier';
export type FormationKind = 'wedge' | 'arc' | 'ring' | 'spiral' | 'minefield' | 'splitter' | 'mixed';
export type DamageSource = 'cover' | 'halo' | 'shockwave' | 'burst' | 'mine' | 'data';
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
  premiumArt: PremiumArtKind | null;
  impactFlash: number;
  damageMask: number;
  launchTimer: number;
  launchedCount: number;
  carrierLaunched: boolean;
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
  damageFxTimer: number;
  destructionTime: number;
  destructionStage: number;
  weakPoints: BossWeakPoint[];
}

export interface HullFragment extends Vec2 {
  active: boolean;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  life: number;
  maxLife: number;
  armorSection: boolean;
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
  visual: 'spark' | 'wisp';
}

export interface PremiumFragment extends Vec2 {
  active: boolean;
  art: PremiumArtKind;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  life: number;
  maxLife: number;
  glow: number;
  stage: 'detached' | 'core';
}

export interface PremiumDestructionCue extends Vec2 {
  active: boolean;
  art: PremiumArtKind;
  rotation: number;
  inheritedVx: number;
  inheritedVy: number;
  seed: number;
  delay: number;
  sequenceStep: number;
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
  hullFragments: number;
  premiumTargets: number;
  texturedTargets: number;
  premiumTypesSeen: number;
  premiumFragments: number;
  premiumAssetsLoaded: number;
  premiumAssetFailures: number;
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
  bossDestructionTime: number;
  carrierDrones: number;
}
