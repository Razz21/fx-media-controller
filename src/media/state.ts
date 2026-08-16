import { logger } from '../utils/logger';
import {
  type MediaControllerBinding,
  type MediaControllerState,
  bindMediaController,
} from './controller';

type Listener = (state: MediaControllerState) => void;

export class TabMediaState {
  private binding: MediaControllerBinding | null = null;
  private listeners = new Set<Listener>();
  private tickListeners = new Set<Listener>();
  private tab: BrowserTab;

  constructor(tab: BrowserTab) {
    this.tab = tab;
    this.binding = bindMediaController(
      tab,
      (state) => this.notify(state),
      (state) => this.notifyTick(state),
    );
  }

  /**
   * @param listener Structural updates (active/playing/capabilities/
   *   metadata, or a position snapshot tied to a real event). Always
   *   fired;
   * @param onPositionTick Optional. Per-animation-frame position-only
   *   updates while playing and tracked.
   */
  subscribe(listener: Listener, onPositionTick?: Listener): () => void {
    this.listeners.add(listener);
    if (onPositionTick) {
      this.tickListeners.add(onPositionTick);
    }
    if (this.binding) {
      this.binding.update();
    }
    return () => {
      this.listeners.delete(listener);
      if (onPositionTick) {
        this.tickListeners.delete(onPositionTick);
      }
    };
  }

  /**
   * Starts position tracking (RAF loop + fallback poll) on the underlying
   * binding. Must only be called by a consumer that actually renders
   * position, i.e. the popup, and only while it's visible.
   */
  enableTracking(): void {
    this.binding?.enableTracking();
  }

  /**
   * Stops position tracking. Safe to call unconditionally.
   */
  disableTracking(): void {
    this.binding?.disableTracking();
  }

  /**
   * Primes the tracker with a specific position without pushing an update.
   * Used after a seek to align the cached position with the target.
   */
  primeSeek(position: number): void {
    this.binding?.primeSeek(position);
  }

  private notify(state: MediaControllerState): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        logger.error(e);
      }
    }
  }

  private notifyTick(state: MediaControllerState): void {
    for (const listener of this.tickListeners) {
      try {
        listener(state);
      } catch (e) {
        logger.error(e);
      }
    }
  }

  destroy(): void {
    this.binding?.destroy();
    this.binding = null;
    this.listeners.clear();
    this.tickListeners.clear();
  }
}

const tabStates = new WeakMap<BrowserTab, TabMediaState>();

export function getTabMediaState(tab: BrowserTab): TabMediaState {
  let state = tabStates.get(tab);
  if (!state) {
    state = new TabMediaState(tab);
    tabStates.set(tab, state);
  }
  return state;
}

export function destroyTabMediaState(tab: BrowserTab): void {
  const state = tabStates.get(tab);
  if (state) {
    state.destroy();
    tabStates.delete(tab);
  }
}
