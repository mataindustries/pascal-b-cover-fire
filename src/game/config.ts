export const STAGE = {
  width: 450,
  height: 800,
  hudTop: 74,
  floorY: 706,
} as const;

export const COLORS = {
  space: '#06080D',
  gunmetal: '#222A33',
  steel: '#7D8994',
  ivory: '#F3E7CE',
  amber: '#FFB000',
  coral: '#FF4E3D',
  blue: '#44C7F4',
  lime: '#B9E937',
  muted: '#87939D',
} as const;

export const MOTHERSHIP = {
  spritePath: '/assets/ships/pascal-b-mothership.png',
  sourceWidth: 1_230,
  sourceHeight: 1_278,
  renderWidth: 414,
  renderHeight: 430.54,
  centerY: 372,
  weakPointRadius: 19,
  coreAnchors: [
    { x: 250, y: 630 },
    { x: 615, y: 568 },
    { x: 980, y: 630 },
  ] as const,
} as const;

export const TUNING = {
  fixedStep: 1 / 60,
  maxFrameDelta: 0.1,
  maxSubSteps: 6,
  aimLimit: 0.46,
  chargeSeconds: 1.65,
  minimumCharge: 0.18,
  launchHitStop: 0.085,
  launchAfterglowSeconds: 0.72,
  ascentDuration: 2.75,
  orbitDuration: 60,
  bossPressureRampSeconds: 22,
  comboWindow: 1.05,
  playerRadius: 16,
  playerMaxSpeed: 590,
  playerMinOrbitSpeed: 255,
  steeringAcceleration: 390,
  playerArenaBottom: 690,
  haloMaxOrbiters: 36,
  haloMaxRadius: 78,
  haloMassCapacity: 128,
  maxWorldObjects: 72,
  normalActiveTargets: 25,
  peakActiveTargets: 50,
  maxEnemies: 60,
  maxParticles: 220,
  maxShockwaves: 12,
  maxGameplayWaves: 12,
  maxBurstShards: 28,
  maxEffectLinks: 24,
  maxImpactTexts: 6,
  maxHullFragments: 24,
  maxChainImpactsPerStep: 16,
  maxCatastrophes: 3,
  haloThresholds: [8, 24, 54, 96] as readonly number[],
  coreBurstMinimumMass: 15,
  coreBurstBaseRetention: 0.56,
  coreBurstRetentionPerMagneticLevel: 0.035,
  coreBurstShardSpeed: 465,
  coreBurstShardLife: 0.92,
  overdriveHighThreshold: 0.72,
  firstUpgradeCost: 180,
} as const;

export const UPGRADE_DEFINITIONS = {
  launchPressure: {
    name: 'Launch Pressure',
    code: 'LP',
    description: '+9% entry velocity and +5% starting Overdrive',
    maxLevel: 5,
  },
  reinforcedCover: {
    name: 'Reinforced Cover',
    code: 'RC',
    description: '+18 integrity, contact power and recovery',
    maxLevel: 5,
  },
  magneticRim: {
    name: 'Magnetic Rim',
    code: 'MR',
    description: '+22% capture and +3.5% Core Burst retention',
    maxLevel: 5,
  },
} as const;

export const STORAGE_KEY = 'pascal-b-cover-fire:v1';
