import { COLORS, MOTHERSHIP } from '../config';
import type { PremiumArtKind, TargetKind, Vec2 } from '../types';

export type PremiumAssetRole = 'common' | 'ambient' | 'prestige';

export interface PremiumFragmentDefinition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly stage: 'detached' | 'core';
}

export interface PremiumAssetDefinition {
  readonly path: string;
  readonly label: string;
  readonly role: PremiumAssetRole;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly renderWidth: number;
  readonly palette: readonly [string, string, string];
  readonly fragments: readonly PremiumFragmentDefinition[];
  readonly damageAnchors?: readonly Vec2[];
}

export const PREMIUM_COMMON_KINDS = [
  'hunterDrone',
  'antimatterReactorPod',
  'shieldedCargoDrone',
] as const satisfies readonly PremiumArtKind[];

export const PREMIUM_AMBIENT_KINDS = [
  'communicationsSatellite',
  'goldTelescope',
  'fuelDepot',
  'solarPowerStation',
  'observationModule',
  'alienInterceptor',
] as const satisfies readonly PremiumArtKind[];

export const PREMIUM_PRESTIGE_KINDS = [
  'luxurySpaceYacht',
  'orbitalDatacenter',
  'crownDroneCarrier',
] as const satisfies readonly PremiumArtKind[];

export const PREMIUM_ART_KINDS = [
  ...PREMIUM_COMMON_KINDS,
  ...PREMIUM_AMBIENT_KINDS,
  ...PREMIUM_PRESTIGE_KINDS,
] as const satisfies readonly PremiumArtKind[];

export const PREMIUM_ASSETS: Record<PremiumArtKind, PremiumAssetDefinition> = {
  communicationsSatellite: {
    path: '/assets/premium/communications-satellite.webp',
    label: 'COMMUNICATIONS SATELLITE',
    role: 'ambient',
    imageWidth: 512,
    imageHeight: 488,
    renderWidth: 60,
    palette: ['#F3E7CE', '#44C7F4', '#E9A82E'],
    fragments: [
      { x: 0.01, y: 0.01, width: 0.39, height: 0.42, stage: 'detached' },
      { x: 0.01, y: 0.52, width: 0.39, height: 0.43, stage: 'detached' },
      { x: 0.62, y: 0.56, width: 0.37, height: 0.43, stage: 'detached' },
      { x: 0.54, y: 0.11, width: 0.40, height: 0.42, stage: 'detached' },
      { x: 0.34, y: 0.33, width: 0.35, height: 0.36, stage: 'core' },
      { x: 0.35, y: 0.01, width: 0.18, height: 0.34, stage: 'core' },
    ],
  },
  goldTelescope: {
    path: '/assets/premium/gold-telescope.webp',
    label: 'GOLD TELESCOPE',
    role: 'ambient',
    imageWidth: 502,
    imageHeight: 512,
    renderWidth: 64,
    palette: ['#FFF4C5', '#EFB83E', '#72D9FF'],
    fragments: [
      { x: 0.31, y: 0.01, width: 0.38, height: 0.27, stage: 'detached' },
      { x: 0.10, y: 0.20, width: 0.30, height: 0.42, stage: 'detached' },
      { x: 0.60, y: 0.20, width: 0.30, height: 0.42, stage: 'detached' },
      { x: 0.02, y: 0.48, width: 0.25, height: 0.24, stage: 'detached' },
      { x: 0.73, y: 0.48, width: 0.25, height: 0.24, stage: 'detached' },
      { x: 0.29, y: 0.29, width: 0.42, height: 0.46, stage: 'core' },
      { x: 0.36, y: 0.72, width: 0.28, height: 0.27, stage: 'core' },
    ],
  },
  fuelDepot: {
    path: '/assets/premium/fuel-depot.webp',
    label: 'VOLATILE FUEL DEPOT',
    role: 'ambient',
    imageWidth: 461,
    imageHeight: 512,
    renderWidth: 58,
    palette: ['#FFF8DD', '#FF9D2E', '#FFD04E'],
    fragments: [
      { x: 0.34, y: 0.01, width: 0.32, height: 0.34, stage: 'detached' },
      { x: 0.02, y: 0.18, width: 0.36, height: 0.33, stage: 'detached' },
      { x: 0.62, y: 0.18, width: 0.36, height: 0.33, stage: 'detached' },
      { x: 0.03, y: 0.56, width: 0.37, height: 0.31, stage: 'detached' },
      { x: 0.60, y: 0.56, width: 0.37, height: 0.31, stage: 'detached' },
      { x: 0.35, y: 0.70, width: 0.30, height: 0.29, stage: 'detached' },
      { x: 0.31, y: 0.31, width: 0.38, height: 0.38, stage: 'core' },
    ],
  },
  solarPowerStation: {
    path: '/assets/premium/solar-power-station.webp',
    label: 'SOLAR POWER STATION',
    role: 'ambient',
    imageWidth: 498,
    imageHeight: 512,
    renderWidth: 72,
    palette: ['#EAF8FF', '#318DFF', '#FFB43D'],
    fragments: [
      { x: 0.12, y: 0.03, width: 0.29, height: 0.35, stage: 'detached' },
      { x: 0.59, y: 0.03, width: 0.29, height: 0.35, stage: 'detached' },
      { x: 0.01, y: 0.39, width: 0.31, height: 0.24, stage: 'detached' },
      { x: 0.68, y: 0.39, width: 0.31, height: 0.24, stage: 'detached' },
      { x: 0.12, y: 0.68, width: 0.29, height: 0.31, stage: 'detached' },
      { x: 0.59, y: 0.68, width: 0.29, height: 0.31, stage: 'detached' },
      { x: 0.28, y: 0.27, width: 0.44, height: 0.46, stage: 'core' },
    ],
  },
  observationModule: {
    path: '/assets/premium/observation-module.webp',
    label: 'OBSERVATION MODULE',
    role: 'ambient',
    imageWidth: 496,
    imageHeight: 512,
    renderWidth: 67,
    palette: ['#FFF8D7', '#D9A62D', '#8DE4FF'],
    fragments: [
      { x: 0.03, y: 0.09, width: 0.30, height: 0.28, stage: 'detached' },
      { x: 0.67, y: 0.09, width: 0.30, height: 0.28, stage: 'detached' },
      { x: 0.01, y: 0.40, width: 0.30, height: 0.26, stage: 'detached' },
      { x: 0.69, y: 0.40, width: 0.30, height: 0.26, stage: 'detached' },
      { x: 0.03, y: 0.64, width: 0.31, height: 0.27, stage: 'detached' },
      { x: 0.66, y: 0.64, width: 0.31, height: 0.27, stage: 'detached' },
      { x: 0.29, y: 0.25, width: 0.42, height: 0.48, stage: 'core' },
      { x: 0.34, y: 0.70, width: 0.32, height: 0.29, stage: 'core' },
    ],
  },
  alienInterceptor: {
    path: '/assets/premium/alien-interceptor.webp',
    label: 'ALIEN INTERCEPTOR',
    role: 'ambient',
    imageWidth: 497,
    imageHeight: 512,
    renderWidth: 52,
    palette: ['#DFF8FF', '#2CBAFF', '#FF6A22'],
    fragments: [
      { x: 0.01, y: 0.43, width: 0.36, height: 0.50, stage: 'detached' },
      { x: 0.63, y: 0.43, width: 0.36, height: 0.50, stage: 'detached' },
      { x: 0.28, y: 0.01, width: 0.22, height: 0.43, stage: 'detached' },
      { x: 0.50, y: 0.01, width: 0.22, height: 0.43, stage: 'detached' },
      { x: 0.31, y: 0.64, width: 0.19, height: 0.34, stage: 'detached' },
      { x: 0.50, y: 0.64, width: 0.19, height: 0.34, stage: 'detached' },
      { x: 0.33, y: 0.30, width: 0.34, height: 0.42, stage: 'core' },
    ],
  },
  hunterDrone: {
    path: '/assets/premium/hunter-drone.webp',
    label: 'HUNTER DRONE',
    role: 'common',
    imageWidth: 181,
    imageHeight: 192,
    renderWidth: 30,
    palette: ['#F7F1E8', '#2CB8FF', '#FF6A22'],
    damageAnchors: [{ x: 0.5, y: 0.48 }],
    fragments: [
      { x: 0.00, y: 0.34, width: 0.42, height: 0.46, stage: 'detached' },
      { x: 0.58, y: 0.34, width: 0.42, height: 0.46, stage: 'detached' },
      { x: 0.20, y: 0.65, width: 0.23, height: 0.34, stage: 'detached' },
      { x: 0.57, y: 0.65, width: 0.23, height: 0.34, stage: 'detached' },
      { x: 0.35, y: 0.34, width: 0.30, height: 0.31, stage: 'core' },
      { x: 0.35, y: 0.00, width: 0.30, height: 0.39, stage: 'core' },
    ],
  },
  antimatterReactorPod: {
    path: '/assets/premium/antimatter-reactor-pod.webp',
    label: 'ANTIMATTER REACTOR POD',
    role: 'common',
    imageWidth: 224,
    imageHeight: 216,
    renderWidth: 38,
    palette: ['#FFF4DC', '#FF8B24', '#44C7F4'],
    damageAnchors: [{ x: 0.5, y: 0.5 }],
    fragments: [
      { x: 0.00, y: 0.00, width: 0.42, height: 0.42, stage: 'detached' },
      { x: 0.58, y: 0.00, width: 0.42, height: 0.42, stage: 'detached' },
      { x: 0.00, y: 0.58, width: 0.42, height: 0.42, stage: 'detached' },
      { x: 0.58, y: 0.58, width: 0.42, height: 0.42, stage: 'detached' },
      { x: 0.26, y: 0.24, width: 0.48, height: 0.50, stage: 'core' },
      { x: 0.35, y: 0.03, width: 0.30, height: 0.30, stage: 'core' },
    ],
  },
  shieldedCargoDrone: {
    path: '/assets/premium/shielded-cargo-drone.webp',
    label: 'SHIELDED CARGO DRONE',
    role: 'common',
    imageWidth: 256,
    imageHeight: 244,
    renderWidth: 48,
    palette: ['#F7F5EB', '#42D8FF', '#E8B642'],
    damageAnchors: [{ x: 0.5, y: 0.5 }, { x: 0.28, y: 0.64 }, { x: 0.72, y: 0.64 }],
    fragments: [
      { x: 0.05, y: 0.08, width: 0.42, height: 0.42, stage: 'detached' },
      { x: 0.53, y: 0.08, width: 0.42, height: 0.42, stage: 'detached' },
      { x: 0.04, y: 0.46, width: 0.43, height: 0.47, stage: 'detached' },
      { x: 0.53, y: 0.46, width: 0.43, height: 0.47, stage: 'detached' },
      { x: 0.33, y: 0.33, width: 0.34, height: 0.42, stage: 'core' },
      { x: 0.37, y: 0.08, width: 0.26, height: 0.28, stage: 'core' },
    ],
  },
  luxurySpaceYacht: {
    path: '/assets/premium/luxury-space-yacht.webp',
    label: 'LUXURY SPACE YACHT',
    role: 'prestige',
    imageWidth: 640,
    imageHeight: 427,
    renderWidth: 118,
    palette: ['#FFF8EB', '#D9AB43', '#317CFF'],
    damageAnchors: [
      { x: 0.43, y: 0.16 }, { x: 0.80, y: 0.69 }, { x: 0.51, y: 0.83 },
      { x: 0.35, y: 0.55 }, { x: 0.82, y: 0.26 },
    ],
    fragments: [
      { x: 0.34, y: 0.00, width: 0.31, height: 0.31, stage: 'detached' },
      { x: 0.67, y: 0.42, width: 0.32, height: 0.49, stage: 'detached' },
      { x: 0.37, y: 0.59, width: 0.28, height: 0.40, stage: 'detached' },
      { x: 0.00, y: 0.48, width: 0.40, height: 0.48, stage: 'detached' },
      { x: 0.72, y: 0.02, width: 0.27, height: 0.43, stage: 'detached' },
      { x: 0.24, y: 0.30, width: 0.44, height: 0.42, stage: 'core' },
      { x: 0.55, y: 0.17, width: 0.34, height: 0.46, stage: 'core' },
    ],
  },
  orbitalDatacenter: {
    path: '/assets/premium/orbital-datacenter.webp',
    label: 'ORBITAL DATACENTER',
    role: 'prestige',
    imageWidth: 640,
    imageHeight: 585,
    renderWidth: 112,
    palette: ['#F8F5EA', '#35D5FF', '#E5AF35'],
    damageAnchors: [
      { x: 0.31, y: 0.27 }, { x: 0.73, y: 0.29 }, { x: 0.27, y: 0.73 }, { x: 0.73, y: 0.72 },
    ],
    fragments: [
      { x: 0.07, y: 0.03, width: 0.43, height: 0.43, stage: 'detached' },
      { x: 0.50, y: 0.06, width: 0.47, height: 0.42, stage: 'detached' },
      { x: 0.01, y: 0.50, width: 0.48, height: 0.47, stage: 'detached' },
      { x: 0.50, y: 0.49, width: 0.47, height: 0.49, stage: 'detached' },
      { x: 0.30, y: 0.27, width: 0.41, height: 0.46, stage: 'core' },
      { x: 0.43, y: 0.00, width: 0.20, height: 0.42, stage: 'core' },
    ],
  },
  crownDroneCarrier: {
    path: '/assets/premium/crown-drone-carrier.webp',
    label: 'CROWN DRONE CARRIER',
    role: 'prestige',
    imageWidth: 640,
    imageHeight: 431,
    renderWidth: 132,
    palette: ['#F7F2E9', '#2ABEFF', '#FF8724'],
    damageAnchors: [
      { x: 0.34, y: 0.46 }, { x: 0.66, y: 0.46 }, { x: 0.16, y: 0.56 }, { x: 0.84, y: 0.56 },
    ],
    fragments: [
      { x: 0.15, y: 0.24, width: 0.34, height: 0.44, stage: 'detached' },
      { x: 0.51, y: 0.24, width: 0.34, height: 0.44, stage: 'detached' },
      { x: 0.00, y: 0.30, width: 0.28, height: 0.61, stage: 'detached' },
      { x: 0.72, y: 0.30, width: 0.28, height: 0.61, stage: 'detached' },
      { x: 0.33, y: 0.12, width: 0.34, height: 0.52, stage: 'core' },
      { x: 0.38, y: 0.42, width: 0.24, height: 0.51, stage: 'core' },
    ],
  },
};

export type PremiumAssetKey = PremiumArtKind | 'mothership';

export const PREMIUM_RUNTIME_PATHS: Record<PremiumAssetKey, string> = {
  communicationsSatellite: PREMIUM_ASSETS.communicationsSatellite.path,
  goldTelescope: PREMIUM_ASSETS.goldTelescope.path,
  fuelDepot: PREMIUM_ASSETS.fuelDepot.path,
  solarPowerStation: PREMIUM_ASSETS.solarPowerStation.path,
  observationModule: PREMIUM_ASSETS.observationModule.path,
  alienInterceptor: PREMIUM_ASSETS.alienInterceptor.path,
  hunterDrone: PREMIUM_ASSETS.hunterDrone.path,
  antimatterReactorPod: PREMIUM_ASSETS.antimatterReactorPod.path,
  shieldedCargoDrone: PREMIUM_ASSETS.shieldedCargoDrone.path,
  luxurySpaceYacht: PREMIUM_ASSETS.luxurySpaceYacht.path,
  orbitalDatacenter: PREMIUM_ASSETS.orbitalDatacenter.path,
  crownDroneCarrier: PREMIUM_ASSETS.crownDroneCarrier.path,
  mothership: MOTHERSHIP.spritePath,
};

const COMMON_TARGET_ART: Partial<Record<TargetKind, PremiumArtKind>> = {
  swarmer: 'hunterDrone',
  mine: 'antimatterReactorPod',
  splitter: 'shieldedCargoDrone',
  splitterFragment: 'shieldedCargoDrone',
};

export const targetVisualArt = (
  kind: TargetKind,
  assignedArt: PremiumArtKind | null = null,
): PremiumArtKind | null => assignedArt ?? COMMON_TARGET_ART[kind] ?? null;

export const premiumGameplayKind = (art: PremiumArtKind): TargetKind => {
  if (art === 'fuelDepot' || art === 'antimatterReactorPod') return 'mine';
  if (art === 'solarPowerStation') return 'solar';
  if (art === 'hunterDrone') return 'swarmer';
  if (art === 'alienInterceptor' || art === 'shieldedCargoDrone') return 'splitter';
  if (art === 'luxurySpaceYacht') return 'yacht';
  if (art === 'orbitalDatacenter') return 'datacenter';
  if (art === 'crownDroneCarrier') return 'carrier';
  return 'satellite';
};

export const isPremiumArtCompatible = (kind: TargetKind, art: PremiumArtKind): boolean => {
  if (kind === 'splitterFragment' && art === 'shieldedCargoDrone') return true;
  if (art === 'alienInterceptor' && kind === 'swarmer') return true;
  return premiumGameplayKind(art) === kind;
};

export const isPrestigeArt = (art: PremiumArtKind): boolean => PREMIUM_ASSETS[art].role === 'prestige';

export const prestigeSubsystemCount = (art: PremiumArtKind): number => {
  if (art === 'luxurySpaceYacht') return 5;
  if (art === 'orbitalDatacenter' || art === 'crownDroneCarrier') return 4;
  return 0;
};

export const premiumFallbackColor = (art: PremiumArtKind): string => {
  if (art === 'alienInterceptor' || art === 'hunterDrone') return COLORS.blue;
  if (art === 'fuelDepot' || art === 'antimatterReactorPod') return COLORS.coral;
  if (art === 'solarPowerStation') return '#318DFF';
  if (art === 'shieldedCargoDrone' || art === 'orbitalDatacenter') return '#35D5FF';
  if (art === 'crownDroneCarrier') return '#FF8724';
  return COLORS.amber;
};
