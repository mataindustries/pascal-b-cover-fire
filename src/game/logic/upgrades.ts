import { TUNING, UPGRADE_DEFINITIONS } from '../config';
import type { PersistedState, UpgradeKey } from '../types';

export const upgradePrice = (level: number): number => {
  const safeLevel = Math.max(0, Math.floor(level));
  return Math.round(TUNING.firstUpgradeCost * (1 + safeLevel * 0.85 + safeLevel * safeLevel * 0.32));
};

export interface PurchaseResult {
  state: PersistedState;
  purchased: boolean;
  reason?: 'insufficient-scrap' | 'max-level';
}

export const purchaseUpgrade = (state: PersistedState, key: UpgradeKey): PurchaseResult => {
  const level = state.upgrades[key];
  const definition = UPGRADE_DEFINITIONS[key];
  if (level >= definition.maxLevel) {
    return { state, purchased: false, reason: 'max-level' };
  }

  const price = upgradePrice(level);
  if (state.scrap < price) {
    return { state, purchased: false, reason: 'insufficient-scrap' };
  }

  return {
    purchased: true,
    state: {
      ...state,
      scrap: state.scrap - price,
      upgrades: { ...state.upgrades, [key]: level + 1 },
    },
  };
};

export const launchVelocityMultiplier = (level: number): number => 1 + level * 0.07;
export const coverIntegrityBonus = (level: number): number => level * 12;
export const impactPowerMultiplier = (level: number): number => 1 + level * 0.12;
export const magneticCaptureMultiplier = (level: number): number => 1 + level * 0.16;
