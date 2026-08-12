import { STAGE } from '../config';
import { clamp, magnitude } from '../math';
import type { Vec2 } from '../types';

export interface PointerInput {
  x: number;
  y: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  totalX: number;
  totalY: number;
  pointerId: number;
}

export interface InputCallbacks {
  onPointerDown(input: PointerInput): void;
  onPointerMove(input: PointerInput): void;
  onPointerUp(input: PointerInput): void;
  onChargeStart(): void;
  onChargeEnd(): void;
  onPause(): void;
  onRestart(): void;
}

export class InputManager {
  private readonly keys = new Set<string>();
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerSteer: Vec2 = { x: 0, y: 0 };

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: InputCallbacks,
  ) {
    canvas.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
    canvas.addEventListener('pointermove', this.handlePointerMove, { passive: false });
    canvas.addEventListener('pointerup', this.handlePointerUp, { passive: false });
    canvas.addEventListener('pointercancel', this.handlePointerUp, { passive: false });
    canvas.addEventListener('lostpointercapture', this.handleLostPointerCapture);
    canvas.addEventListener('contextmenu', this.preventDefault);
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: false });
    window.addEventListener('blur', this.handleBlur);
  }

  public getSteering(): Vec2 {
    const keyboard = this.getKeyboardSteering();
    return magnitude(keyboard.x, keyboard.y) > 0 ? keyboard : this.pointerSteer;
  }

  public getKeyboardSteering(): Vec2 {
    const x = (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0)
      - (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0);
    const y = (this.keys.has('ArrowDown') || this.keys.has('KeyS') ? 1 : 0)
      - (this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 1 : 0);
    const length = magnitude(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  public clearPointerSteering(): void {
    this.pointerSteer = { x: 0, y: 0 };
    this.pointerId = null;
  }

  public reset(): void {
    if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId)) {
      this.canvas.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
    this.pointerSteer = { x: 0, y: 0 };
    this.keys.clear();
  }

  public destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('lostpointercapture', this.handleLostPointerCapture);
    this.canvas.removeEventListener('contextmenu', this.preventDefault);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }

  private toStage(event: PointerEvent): { x: number; y: number } {
    const bounds = this.canvas.getBoundingClientRect();
    const scale = STAGE.width / Math.max(1, bounds.width);
    const logicalHeight = clamp(STAGE.width * bounds.height / Math.max(1, bounds.width), STAGE.height, 1_000);
    const verticalOffset = (logicalHeight - STAGE.height) * 0.5;
    return {
      x: (event.clientX - bounds.left) * scale,
      y: (event.clientY - bounds.top) * scale - verticalOffset,
    };
  }

  private sample(event: PointerEvent): PointerInput {
    const point = this.toStage(event);
    return {
      ...point,
      startX: this.startX,
      startY: this.startY,
      deltaX: point.x - this.lastX,
      deltaY: point.y - this.lastY,
      totalX: point.x - this.startX,
      totalY: point.y - this.startY,
      pointerId: event.pointerId,
    };
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    if (this.pointerId !== null) return;
    const point = this.toStage(event);
    this.pointerId = event.pointerId;
    this.startX = point.x;
    this.startY = point.y;
    this.lastX = point.x;
    this.lastY = point.y;
    this.pointerSteer = { x: 0, y: 0 };
    this.canvas.setPointerCapture(event.pointerId);
    this.callbacks.onPointerDown(this.sample(event));
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    const input = this.sample(event);
    const rawX = clamp(input.totalX / 82, -1, 1);
    const rawY = clamp(input.totalY / 82, -1, 1);
    const length = magnitude(rawX, rawY);
    this.pointerSteer = length > 1
      ? { x: rawX / length, y: rawY / length }
      : { x: rawX, y: rawY };
    this.callbacks.onPointerMove(input);
    this.lastX = input.x;
    this.lastY = input.y;
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    const input = this.sample(event);
    this.callbacks.onPointerUp(input);
    this.pointerId = null;
    this.pointerSteer = { x: 0, y: 0 };
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    this.keys.add(event.code);
    if (event.code === 'Space') this.callbacks.onChargeStart();
    if (event.code === 'Escape' || event.code === 'KeyP') this.callbacks.onPause();
    if (event.code === 'KeyR') this.callbacks.onRestart();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.delete(event.code);
    if (event.code === 'Space') this.callbacks.onChargeEnd();
  };

  private readonly preventDefault = (event: Event): void => event.preventDefault();

  private readonly handleLostPointerCapture = (): void => {
    this.pointerId = null;
    this.pointerSteer = { x: 0, y: 0 };
  };

  private readonly handleBlur = (): void => this.reset();
}
