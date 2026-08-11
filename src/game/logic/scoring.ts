import { comboMultiplier } from './combo';

export const impactScore = (baseScore: number, combo: number, mass: number): number => {
  const massBonus = 1 + Math.min(Math.max(0, mass), 80) * 0.008;
  return Math.round(Math.max(0, baseScore) * comboMultiplier(combo) * massBonus);
};

export const completionBonus = (mothershipDestroyed: boolean, integrity: number): number => {
  if (!mothershipDestroyed) return 0;
  return 5_000 + Math.round(Math.max(0, integrity) * 18);
};

export const calculateScrap = (
  totalScore: number,
  objectsDestroyed: number,
  mothershipDestroyed: boolean,
): number => {
  const scoreScrap = Math.floor(Math.max(0, totalScore) / 650);
  const destructionScrap = Math.floor(Math.max(0, objectsDestroyed) * 0.8);
  return Math.max(12, scoreScrap + destructionScrap + (mothershipDestroyed ? 28 : 0));
};
