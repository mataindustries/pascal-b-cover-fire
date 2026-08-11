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
  | 'tank'
  | 'antenna'
  | 'asteroid'
  | 'debris'
  | 'drone';

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
  impactCooldown: number;
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
  velocityX: number;
  velocityY: number;
  targets: number;
  particles: number;
  haloOrbiters: number;
  comboTimer: number;
}
