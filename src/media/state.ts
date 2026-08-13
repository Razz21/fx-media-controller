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
  private tab: BrowserTab;

  constructor(tab: BrowserTab) {
    this.tab = tab;
    this.binding = bindMediaController(tab, (state) => this.notify(state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.binding) {
      this.binding.update();
    }
    return () => {
      this.listeners.delete(listener);
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

  destroy(): void {
    this.binding?.destroy();
    this.binding = null;
    this.listeners.clear();
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
