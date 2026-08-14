import { PREMIUM_RUNTIME_PATHS, type PremiumAssetKey } from './premium';

export type PremiumAssetStatus = 'pending' | 'loaded' | 'failed';

export interface PremiumAssetLoadReport {
  readonly loaded: number;
  readonly failed: number;
  readonly total: number;
}

type ImageFactory = () => HTMLImageElement;

export class PremiumAssetStore {
  private readonly images = new Map<PremiumAssetKey, HTMLImageElement>();
  private readonly statuses = new Map<PremiumAssetKey, PremiumAssetStatus>();
  private loadPromise: Promise<PremiumAssetLoadReport> | null = null;

  public constructor(private readonly imageFactory: ImageFactory = () => new Image()) {
    for (const key of Object.keys(PREMIUM_RUNTIME_PATHS) as PremiumAssetKey[]) {
      this.statuses.set(key, 'pending');
    }
  }

  public load(): Promise<PremiumAssetLoadReport> {
    if (this.loadPromise) return this.loadPromise;
    const keys = Object.keys(PREMIUM_RUNTIME_PATHS) as PremiumAssetKey[];
    this.loadPromise = Promise.all(keys.map((key) => this.loadOne(key))).then(() => this.report());
    return this.loadPromise;
  }

  public image(key: PremiumAssetKey): HTMLImageElement | null {
    return this.status(key) === 'loaded' ? this.images.get(key) ?? null : null;
  }

  public status(key: PremiumAssetKey): PremiumAssetStatus {
    return this.statuses.get(key) ?? 'failed';
  }

  public report(): PremiumAssetLoadReport {
    let loaded = 0;
    let failed = 0;
    for (const status of this.statuses.values()) {
      if (status === 'loaded') loaded += 1;
      if (status === 'failed') failed += 1;
    }
    return { loaded, failed, total: this.statuses.size };
  }

  private loadOne(key: PremiumAssetKey): Promise<void> {
    const image = this.imageFactory();
    this.images.set(key, image);
    return new Promise((resolve) => {
      let settled = false;
      const settle = (status: PremiumAssetStatus): void => {
        if (settled) return;
        settled = true;
        this.statuses.set(key, status);
        resolve();
      };
      image.onload = () => settle(image.naturalWidth > 0 ? 'loaded' : 'failed');
      image.onerror = () => settle('failed');
      image.src = PREMIUM_RUNTIME_PATHS[key];
      if (image.complete) queueMicrotask(() => settle(image.naturalWidth > 0 ? 'loaded' : 'failed'));
    });
  }
}
