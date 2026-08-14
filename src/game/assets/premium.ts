import { COLORS, MOTHERSHIP } from '../config';
import type { PremiumArtKind, TargetKind } from '../types';

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
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly renderWidth: number;
  readonly palette: readonly [string, string, string];
  readonly fragments: readonly PremiumFragmentDefinition[];
}

export const PREMIUM_ART_KINDS = [
  'communicationsSatellite',
  'goldTelescope',
  'fuelDepot',
  'solarPowerStation',
  'observationModule',
  'alienInterceptor',
] as const satisfies readonly PremiumArtKind[];

export const PREMIUM_SPAWN_SEQUENCE = [
  'communicationsSatellite',
  'fuelDepot',
  'alienInterceptor',
  'solarPowerStation',
  'communicationsSatellite',
  'fuelDepot',
  'goldTelescope',
  'alienInterceptor',
  'solarPowerStation',
  'communicationsSatellite',
  'observationModule',
  'fuelDepot',
  'alienInterceptor',
  'solarPowerStation',
] as const satisfies readonly PremiumArtKind[];

export const PREMIUM_ASSETS: Record<PremiumArtKind, PremiumAssetDefinition> = {
  communicationsSatellite: {
    path: '/assets/premium/communications-satellite.webp',
    label: 'COMMUNICATIONS SATELLITE',
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
};

export type PremiumAssetKey = PremiumArtKind | 'mothership';

export const PREMIUM_RUNTIME_PATHS: Record<PremiumAssetKey, string> = {
  communicationsSatellite: PREMIUM_ASSETS.communicationsSatellite.path,
  goldTelescope: PREMIUM_ASSETS.goldTelescope.path,
  fuelDepot: PREMIUM_ASSETS.fuelDepot.path,
  solarPowerStation: PREMIUM_ASSETS.solarPowerStation.path,
  observationModule: PREMIUM_ASSETS.observationModule.path,
  alienInterceptor: PREMIUM_ASSETS.alienInterceptor.path,
  mothership: MOTHERSHIP.spritePath,
};

export const isPremiumArtCompatible = (kind: TargetKind, art: PremiumArtKind): boolean => {
  if (art === 'fuelDepot') return kind === 'mine';
  if (art === 'solarPowerStation') return kind === 'solar';
  if (art === 'alienInterceptor') return kind === 'splitter' || kind === 'swarmer';
  return kind === 'satellite' || kind === 'debris';
};

export const premiumGameplayKind = (art: PremiumArtKind): TargetKind => {
  if (art === 'fuelDepot') return 'mine';
  if (art === 'solarPowerStation') return 'solar';
  if (art === 'alienInterceptor') return 'splitter';
  return 'satellite';
};

export const premiumFallbackColor = (art: PremiumArtKind): string => {
  if (art === 'alienInterceptor') return COLORS.blue;
  if (art === 'fuelDepot') return COLORS.coral;
  if (art === 'solarPowerStation') return '#318DFF';
  return COLORS.amber;
};
