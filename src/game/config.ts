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

export const TUNING = {
  fixedStep: 1 / 60,
  maxFrameDelta: 0.1,
  maxSubSteps: 6,
  aimLimit: 0.46,
  chargeSeconds: 2.25,
  minimumCharge: 0.18,
  launchHitStop: 0.085,
  launchAfterglowSeconds: 0.72,
  ascentDuration: 15,
  orbitMinimumDuration: 30,
  orbitForcedFinaleTime: 40,
  orbitFinaleMass: 28,
  bossDuration: 29,
  comboWindow: 2.35,
  playerRadius: 16,
  playerMaxSpeed: 610,
  playerMinOrbitSpeed: 215,
  haloMaxOrbiters: 28,
  haloMaxRadius: 112,
  maxWorldObjects: 30,
  maxParticles: 120,
  maxShockwaves: 12,
  maxImpactTexts: 8,
  haloThresholds: [8, 18, 28, 38] as readonly number[],
  firstUpgradeCost: 180,
} as const;

export const UPGRADE_DEFINITIONS = {
  launchPressure: {
    name: 'Launch Pressure',
    code: 'LP',
    description: '+9% initial velocity per level',
    maxLevel: 5,
  },
  reinforcedCover: {
    name: 'Reinforced Cover',
    code: 'RC',
    description: '+18 integrity and impact power',
    maxLevel: 5,
  },
  magneticRim: {
    name: 'Magnetic Rim',
    code: 'MR',
    description: '+22% halo mass capture',
    maxLevel: 5,
  },
} as const;

export const STORAGE_KEY = 'pascal-b-cover-fire:v1';
