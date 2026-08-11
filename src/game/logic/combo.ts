export interface ComboState {
  count: number;
  timer: number;
  largest: number;
}

export const createComboState = (): ComboState => ({ count: 0, timer: 0, largest: 0 });

export const tickCombo = (state: ComboState, delta: number): ComboState => {
  if (state.count === 0) return state;
  const timer = Math.max(0, state.timer - Math.max(0, delta));
  return timer === 0 ? { ...state, count: 0, timer: 0 } : { ...state, timer };
};

export const registerComboHit = (state: ComboState, windowSeconds: number): ComboState => {
  const count = state.timer > 0 ? state.count + 1 : 1;
  return {
    count,
    timer: windowSeconds,
    largest: Math.max(state.largest, count),
  };
};

export const comboMultiplier = (count: number): number =>
  count <= 1 ? 1 : 1 + Math.min(count - 1, 12) * 0.25;
