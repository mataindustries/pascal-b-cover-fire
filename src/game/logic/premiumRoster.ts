import { seededNoise } from '../math';
import type { PremiumArtKind } from '../types';

/** A tiny deterministic shuffle bag. Each entry appears once before a refill. */
export class PremiumShuffleBag {
  private bag: PremiumArtKind[] = [];
  private cursor = 0;
  private randomSeed = 1;
  private previous: PremiumArtKind | null = null;

  public constructor(private readonly entries: readonly PremiumArtKind[], seed = 1) {
    if (entries.length === 0) throw new Error('Premium shuffle bags require at least one entry.');
    this.reset(seed);
  }

  public reset(seed: number): void {
    this.randomSeed = Math.max(1, Math.floor(seed));
    this.previous = null;
    this.refill();
  }

  public draw(): PremiumArtKind {
    if (this.cursor >= this.bag.length) this.refill();
    const art = this.bag[this.cursor];
    if (!art) throw new Error('Premium shuffle bag unexpectedly exhausted.');
    this.cursor += 1;
    this.previous = art;
    return art;
  }

  public preview(): readonly PremiumArtKind[] {
    return this.bag.slice(this.cursor);
  }

  private refill(): void {
    this.bag = [...this.entries];
    for (let index = this.bag.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      const current = this.bag[index];
      const swap = this.bag[swapIndex];
      if (!current || !swap) continue;
      this.bag[index] = swap;
      this.bag[swapIndex] = current;
    }
    if (this.previous && this.bag.length > 1 && this.bag[0] === this.previous) {
      const swap = this.bag[1];
      if (swap) {
        this.bag[1] = this.bag[0] as PremiumArtKind;
        this.bag[0] = swap;
      }
    }
    this.cursor = 0;
  }

  private random(): number {
    const value = seededNoise(this.randomSeed);
    this.randomSeed += 1;
    return value;
  }
}
