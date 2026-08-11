import { describe, expect, it } from 'vitest';
import {
  defaultPersistedState,
  loadPersistedState,
  parsePersistedState,
  resetPersistedState,
  savePersistedState,
} from '../src/game/logic/persistence';

describe('persisted-state parsing', () => {
  it('returns safe defaults for absent or malformed storage', () => {
    expect(parsePersistedState(null)).toEqual(defaultPersistedState());
    expect(parsePersistedState('{broken')).toEqual(defaultPersistedState());
  });

  it('sanitizes hostile, old, or out-of-range values', () => {
    const parsed = parsePersistedState(JSON.stringify({
      version: 900,
      bestScore: Number.POSITIVE_INFINITY,
      scrap: -40,
      seenHint: 'yes',
      muted: true,
      volume: 8,
      upgrades: { launchPressure: 2.9, reinforcedCover: -4, magneticRim: 99 },
    }));

    expect(parsed).toEqual({
      version: 1,
      bestScore: 0,
      scrap: 0,
      seenHint: false,
      muted: true,
      volume: 1,
      upgrades: { launchPressure: 2, reinforcedCover: 0, magneticRim: 5 },
    });
  });

  it('serializes the normalized state under the stable storage key', () => {
    let key = '';
    let value = '';
    savePersistedState(defaultPersistedState(), {
      setItem: (nextKey, nextValue) => {
        key = nextKey;
        value = nextValue;
      },
    });

    expect(key).toBe('pascal-b-cover-fire:v1');
    expect(JSON.parse(value)).toEqual(defaultPersistedState());
  });

  it('degrades to session-only defaults when a browser blocks storage', () => {
    const unavailable = (): never => { throw new Error('storage disabled'); };
    expect(loadPersistedState({ getItem: unavailable })).toEqual(defaultPersistedState());
    expect(() => savePersistedState(defaultPersistedState(), { setItem: unavailable })).not.toThrow();
    expect(resetPersistedState({ removeItem: unavailable })).toEqual(defaultPersistedState());
  });
});
