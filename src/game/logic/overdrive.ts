import { TUNING } from '../config';
import { clamp } from '../math';

export interface OverdriveState {
  value: number;
  high: boolean;
}

export const createOverdriveState = (startingValue = 0): OverdriveState => ({
  value: clamp(startingValue, 0, 1),
  high: startingValue >= TUNING.overdriveHighThreshold,
});

export const tickOverdrive = (
  state: OverdriveState,
  delta: number,
  sustainingChain: boolean,
  grazingDanger: boolean,
): OverdriveState => {
  const safeDelta = Math.max(0, delta);
  const pressureGain = (sustainingChain ? 0.06 : 0) + (grazingDanger ? 0.09 : 0);
  const idleDrain = sustainingChain ? 0.03 : 0.045;
  const value = clamp(state.value + (pressureGain - idleDrain) * safeDelta, 0, 1);
  return {
    value,
    high: state.high ? value >= 0.58 : value >= TUNING.overdriveHighThreshold,
  };
};

export const registerOverdriveDestruction = (
  state: OverdriveState,
  chainCount: number,
  volatile: boolean,
): OverdriveState => {
  const chainGain = Math.min(0.006, Math.max(0, chainCount - 1) * 0.00035);
  const value = clamp(state.value + 0.0035 + chainGain + (volatile ? 0.012 : 0), 0, 1);
  return {
    value,
    high: state.high ? value >= 0.58 : value >= TUNING.overdriveHighThreshold,
  };
};

export const overdriveScoreMultiplier = (value: number): number =>
  1 + clamp(value, 0, 1) * 1.5;
