import { STORAGE_KEY } from '../config';
import type { PersistedState, UpgradeKey } from '../types';

const upgradeKeys: UpgradeKey[] = ['launchPressure', 'reinforcedCover', 'magneticRim'];

export const defaultPersistedState = (): PersistedState => ({
  version: 1,
  bestScore: 0,
  scrap: 0,
  seenHint: false,
  muted: false,
  volume: 0.72,
  upgrades: {
    launchPressure: 0,
    reinforcedCover: 0,
    magneticRim: 0,
  },
});

const safeFinite = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

export const parsePersistedState = (raw: string | null): PersistedState => {
  const fallback = defaultPersistedState();
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const upgradesSource = typeof parsed.upgrades === 'object' && parsed.upgrades !== null
      ? parsed.upgrades as Record<string, unknown>
      : {};
    const upgrades = { ...fallback.upgrades };
    for (const key of upgradeKeys) {
      upgrades[key] = Math.floor(safeFinite(upgradesSource[key], 0, 0, 5));
    }

    return {
      version: 1,
      bestScore: Math.floor(safeFinite(parsed.bestScore, 0, 0, 999_999_999)),
      scrap: Math.floor(safeFinite(parsed.scrap, 0, 0, 999_999)),
      seenHint: typeof parsed.seenHint === 'boolean' ? parsed.seenHint : false,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
      volume: safeFinite(parsed.volume, fallback.volume, 0, 1),
      upgrades,
    };
  } catch {
    return fallback;
  }
};

export const loadPersistedState = (storage: Pick<Storage, 'getItem'> = localStorage): PersistedState => {
  try {
    return parsePersistedState(storage.getItem(STORAGE_KEY));
  } catch {
    return defaultPersistedState();
  }
};

export const savePersistedState = (
  state: PersistedState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in hardened/private contexts; gameplay remains session-safe.
  }
};

export const resetPersistedState = (storage: Pick<Storage, 'removeItem'> = localStorage): PersistedState => {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Treat an unavailable storage backend as already reset.
  }
  return defaultPersistedState();
};
