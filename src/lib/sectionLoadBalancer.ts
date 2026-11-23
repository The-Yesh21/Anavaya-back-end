/**
 * SectionLoadBalancer — Sequential Staged Progressive Hydration Engine
 *
 * Prevents memory spikes and CPU saturation by:
 * 1. Holding below-the-fold component mounting while the Preloader curtain runs.
 * 2. Staggering below-the-fold section loading one-by-one through a priority concurrency queue.
 * 3. Promoting sections on-demand when scrolled into the viewport via IntersectionObserver.
 * 4. Yielding the main thread via requestIdleCallback/setTimeout between section mounts.
 */

export type SectionStatus = 'idle' | 'queued' | 'loading' | 'loaded';

export interface SectionDescriptor {
  id: string;
  priority: number;
  status: SectionStatus;
  loadedAt?: number;
}

export interface LoadBalancerTelemetry {
  isPreloaderActive: boolean;
  totalRegistered: number;
  loadedCount: number;
  queueLength: number;
  activeLoadingId: string | null;
  sections: Record<string, SectionStatus>;
}

type TelemetryListener = (telemetry: LoadBalancerTelemetry) => void;
type SectionListener = (loaded: boolean) => void;

const PRELOADER_SESSION_KEY = 'anvaya-preloader-seen';

class SectionLoadBalancerEngine {
  private isPreloaderActive: boolean = true;
  private queue: Array<{ id: string; priority: number }> = [];
  private statuses: Map<string, SectionStatus> = new Map();
  private sectionListeners: Map<string, Set<SectionListener>> = new Map();
  private telemetryListeners: Set<TelemetryListener> = new Set();
  private activeLoadingId: string | null = null;
  private isProcessing: boolean = false;
  private idleTimer: number | null = null;
  private readonly interSectionDelayMs = 120; // Yield time between section mounts

  constructor() {
    if (typeof window === 'undefined') {
      this.isPreloaderActive = false;
      return;
    }

    // Determine initial preloader state
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(PRELOADER_SESSION_KEY) === '1';
    } catch {
      alreadySeen = false;
    }

    if (alreadySeen) {
      this.isPreloaderActive = false;
    } else {
      this.isPreloaderActive = true;
      const onPreloaderDone = () => {
        this.isPreloaderActive = false;
        window.removeEventListener('anvaya:preloader-done', onPreloaderDone);
        this.emitTelemetry();
        this.processQueue();
      };
      window.addEventListener('anvaya:preloader-done', onPreloaderDone);

      // Fallback safeguard: if preloader fails or hangs, unlock after 5 seconds
      window.setTimeout(() => {
        if (this.isPreloaderActive) {
          this.isPreloaderActive = false;
          this.emitTelemetry();
          this.processQueue();
        }
      }, 5000);
    }
  }

  /**
   * Register a section into the load balancer.
   */
  public register(id: string, priority: number): void {
    if (this.statuses.has(id)) return;

    this.statuses.set(id, 'idle');
    this.enqueue(id, priority);
    this.emitTelemetry();
  }

  /**
   * Enqueue a section for sequential loading.
   */
  public enqueue(id: string, priority: number): void {
    const current = this.statuses.get(id);
    if (current === 'loading' || current === 'loaded') return;

    this.statuses.set(id, 'queued');
    if (!this.queue.some((item) => item.id === id)) {
      this.queue.push({ id, priority });
      this.queue.sort((a, b) => a.priority - b.priority);
    }

    this.emitTelemetry();
    this.processQueue();
  }

  /**
   * Request immediate / urgent load (e.g. user scrolled directly into viewport).
   */
  public prioritize(id: string): void {
    const current = this.statuses.get(id);
    if (current === 'loaded') return;

    // Remove from existing queue if present
    this.queue = this.queue.filter((item) => item.id !== id);

    // If currently nothing is loading or we need immediate render
    if (!this.activeLoadingId || this.activeLoadingId === id) {
      this.loadSection(id);
    } else {
      // Prepend to the very front of the queue
      this.queue.unshift({ id, priority: -999 });
      this.statuses.set(id, 'queued');
      this.emitTelemetry();
    }
  }

  /**
   * Subscribe to a section's load state changes.
   */
  public subscribe(id: string, listener: SectionListener): () => void {
    if (!this.sectionListeners.has(id)) {
      this.sectionListeners.set(id, new Set());
    }
    this.sectionListeners.get(id)!.add(listener);

    // Trigger immediately with current state
    if (this.statuses.get(id) === 'loaded') {
      listener(true);
    }

    return () => {
      const set = this.sectionListeners.get(id);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.sectionListeners.delete(id);
      }
    };
  }

  /**
   * Check if a section is already loaded.
   */
  public isLoaded(id: string): boolean {
    return this.statuses.get(id) === 'loaded';
  }

  /**
   * Subscribe to overall telemetry updates.
   */
  public subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    listener(this.getTelemetry());
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  public getTelemetry(): LoadBalancerTelemetry {
    const sectionRecord: Record<string, SectionStatus> = {};
    this.statuses.forEach((status, id) => {
      sectionRecord[id] = status;
    });

    let loadedCount = 0;
    this.statuses.forEach((s) => {
      if (s === 'loaded') loadedCount++;
    });

    return {
      isPreloaderActive: this.isPreloaderActive,
      totalRegistered: this.statuses.size,
      loadedCount,
      queueLength: this.queue.length,
      activeLoadingId: this.activeLoadingId,
      sections: sectionRecord,
    };
  }

  /**
   * Core orchestrator loop: processes sections one-by-one.
   */
  private processQueue(): void {
    if (this.isProcessing) return;
    if (this.isPreloaderActive) return; // Wait until preloader curtain opens
    if (this.activeLoadingId !== null) return; // Concurrency cap: 1 at a time
    if (this.queue.length === 0) return;

    this.isProcessing = true;

    const next = this.queue.shift();
    if (!next) {
      this.isProcessing = false;
      return;
    }

    this.loadSection(next.id);
  }

  private loadSection(id: string): void {
    this.activeLoadingId = id;
    this.statuses.set(id, 'loading');
    this.emitTelemetry();

    // Yield to main thread to allow browser painting & layout before committing next component
    const commitLoad = () => {
      this.statuses.set(id, 'loaded');
      this.activeLoadingId = null;
      this.isProcessing = false;

      // Notify subscribers
      const listeners = this.sectionListeners.get(id);
      if (listeners) {
        listeners.forEach((fn) => fn(true));
      }

      this.emitTelemetry();

      // Schedule next section with idle delay
      if (this.queue.length > 0) {
        this.scheduleNextTick();
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback(commitLoad, { timeout: 300 });
    } else {
      globalThis.setTimeout(commitLoad, 30);
    }
  }

  private scheduleNextTick(): void {
    if (this.idleTimer !== null) globalThis.clearTimeout(this.idleTimer);
    this.idleTimer = globalThis.setTimeout(() => {
      this.idleTimer = null;
      this.processQueue();
    }, this.interSectionDelayMs) as unknown as number;
  }

  private emitTelemetry(): void {
    if (this.telemetryListeners.size === 0) return;
    const telemetry = this.getTelemetry();
    this.telemetryListeners.forEach((l) => l(telemetry));
  }
}

// Global Singleton
export const SectionLoadBalancer = new SectionLoadBalancerEngine();
