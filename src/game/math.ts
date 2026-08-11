import type { Vec2 } from './types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;

export const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const magnitude = (x: number, y: number): number => Math.hypot(x, y);

export const normalize = (x: number, y: number): Vec2 => {
  const length = magnitude(x, y) || 1;
  return { x: x / length, y: y / length };
};

export const distanceSquared = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const circlesOverlap = (a: Vec2, ar: number, b: Vec2, br: number): boolean => {
  const radius = ar + br;
  return distanceSquared(a, b) <= radius * radius;
};

export const sweptCircleHit = (
  from: Vec2,
  to: Vec2,
  movingRadius: number,
  target: Vec2,
  targetRadius: number,
): boolean => {
  const abX = to.x - from.x;
  const abY = to.y - from.y;
  const abLengthSquared = abX * abX + abY * abY;
  const projection = abLengthSquared === 0
    ? 0
    : clamp(((target.x - from.x) * abX + (target.y - from.y) * abY) / abLengthSquared, 0, 1);
  const nearestX = from.x + abX * projection;
  const nearestY = from.y + abY * projection;
  const dx = target.x - nearestX;
  const dy = target.y - nearestY;
  const radius = movingRadius + targetRadius;
  return dx * dx + dy * dy <= radius * radius;
};

export const seededNoise = (seed: number): number => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export const formatNumber = (value: number): string => Math.round(value).toLocaleString('en-US');
