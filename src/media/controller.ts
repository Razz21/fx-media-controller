import { PositionTracker } from './position';
import { hasAnyCapability } from './capabilities';
import { logger } from '../utils/logger';

export interface MediaControllerState {
  active: boolean;
  playing: boolean;
  capabilities: MediaControllerCapabilities;
  metadata: MediaMetadataInit | null;
  position: { duration: number; position: number } | null;
}

export interface MediaControllerCapabilities {
  playPause: boolean;
  previousTrack: boolean;
  nextTrack: boolean;
  seekBackward: boolean;
  seekForward: boolean;
  seekTo: boolean;
}

export interface MediaControllerBinding {
  update(): void;
  destroy(): void;
  /**
   * Enables position tracking (RAF interpolation loop). Must be called
   * by a consumer that actually renders position (currently: the popup,
   * while visible). Notifications of active/playing/capabilities/metadata
   * are NOT gated by this - those always flow, since the tab button needs
   * them regardless of whether anything is tracking position.
   *
   * Position data itself comes exclusively from 'positionstatechange'
   * events (dispatched when the page calls
   * navigator.mediaSession.setPositionState() - see
   * https://searchfox.org/firefox-main/source/dom/chrome-webidl/MediaController.webidl).
   * MediaController has no readable position attribute to poll; those
   * events are cached into the tracker unconditionally (see refreshState),
   * so enableTracking() has real data to resume from even if the popup
   * was closed when the event arrived.
   */
  enableTracking(): void;
  /**
   * Disables position tracking. Safe to call unconditionally.
   */
  disableTracking(): void;
  /**
   * Primes the tracker with a specific position without pushing an update.
   * This is used after a seek to set the cached position to the seek target,
   * so that when tracking is re‑enabled, the UI jumps directly to that value.
   */
  primeSeek(position: number): void;
}

export function getController(tab: BrowserTab): MediaController | null {
  logger.debug(
    '[controller] getController',
    tab.linkedBrowser?.browsingContext?.id,
  );
  return tab.linkedBrowser?.browsingContext?.mediaController ?? null;
}

function getCapabilities(
  controller: MediaController | null,
): MediaControllerCapabilities {
  if (!controller) {
    return {
      playPause: false,
      previousTrack: false,
      nextTrack: false,
      seekBackward: false,
      seekForward: false,
      seekTo: false,
    };
  }

  const supportedKeys = controller.supportedKeys;

  return {
    playPause:
      supportedKeys.includes('playpause') ||
      (supportedKeys.includes('play') && supportedKeys.includes('pause')),
    previousTrack: supportedKeys.includes('previoustrack'),
    nextTrack: supportedKeys.includes('nexttrack'),
    seekBackward: supportedKeys.includes('seekbackward'),
    seekForward: supportedKeys.includes('seekforward'),
    seekTo: supportedKeys.includes('seekto'),
  };
}

/**
 * Synchronous check for whether a tab currently has controllable media -
 * i.e. whether it's worth building any popup/subscription machinery for a
 * hover on this tab at all.
 *
 * Note: reading tab.linkedBrowser.browsingContext.mediaController is not
 * side-effect-free - it lazily creates a MediaController on the underlying
 * CanonicalBrowsingContext on first access and caches it there (see
 * CanonicalBrowsingContext::GetMediaController,
 * mozilla-central/docshell/base/CanonicalBrowsingContext.cpp). Every
 * content tab ends up with one eventually regardless of call site;
 */
export function hasActiveMediaController(tab: BrowserTab): boolean {
  const controller = getController(tab);
  if (!controller?.isActive) return false;

  return hasAnyCapability(getCapabilities(controller));
}

// ------------------------------------------------------------------------
// Main binding
// ------------------------------------------------------------------------
export function bindMediaController(
  tab: BrowserTab,
  onStateChange: (state: MediaControllerState) => void,
  onPositionTick: (state: MediaControllerState) => void,
): MediaControllerBinding {
  const win = (tab.ownerDocument?.defaultView ||
    tab.ownerGlobal ||
    window) as Window;
  let controller: MediaController | null = null;
  let isDestroyed = false;

  // Gates position tracking (RAF interpolation) ONLY. Does not gate
  // active/playing/capabilities/metadata notifications. Defaults to false: a
  // freshly-created binding (e.g. one created just so the tab button has
  // an icon to show) must never start the RAF loop on its own.
  let trackingEnabled = false;

  let cachedActive = false;
  let cachedPlaying = false;
  let cachedCapabilities: MediaControllerCapabilities = {
    playPause: false,
    previousTrack: false,
    nextTrack: false,
    seekBackward: false,
    seekForward: false,
    seekTo: false,
  };
  let cachedMetadata: MediaMetadataInit | null = null;

  function buildState(
    positionOverride?: { duration: number; position: number } | null,
  ): MediaControllerState {
    return {
      active: cachedActive,
      playing: cachedPlaying,
      capabilities: cachedCapabilities,
      metadata: cachedMetadata,
      position: positionOverride || null,
    };
  }

  const tracker = new PositionTracker(
    win,
    (pos: { duration: number; position: number }) => {
      logger.debug('[controller] PositionTracker onUpdate with pos:', pos);
      pushFullState(pos);
    },
    (pos: { duration: number; position: number }) => {
      pushPositionTick(pos);
    },
  );

  function pushFullState(
    positionOverride?: { duration: number; position: number } | null,
  ): void {
    if (isDestroyed) return;
    const state = buildState(positionOverride);
    logger.debug('[controller] pushFullState with position:', positionOverride);
    onStateChange(state);
  }

  function pushPositionTick(positionOverride: {
    duration: number;
    position: number;
  }): void {
    if (isDestroyed) return;
    onPositionTick(buildState(positionOverride));
  }

  function refreshState(event?: PositionStateEvent): void {
    if (isDestroyed) return;
    logger.debug('[controller] refreshState called', event);

    const currentController = getController(tab);

    if (currentController !== controller) {
      if (controller) {
        logger.debug(
          '[controller] removing event listeners from old controller',
        );
        controller.removeEventListener(
          'playbackstatechange',
          onControllerEvent,
        );
        controller.removeEventListener('activated', onControllerEvent);
        controller.removeEventListener('deactivated', onControllerEvent);
        controller.removeEventListener(
          'supportedkeyschange',
          onControllerEvent,
        );
        controller.removeEventListener(
          'positionstatechange',
          onControllerEvent,
        );
      }
      controller = currentController;
      if (controller) {
        logger.debug(
          '[controller] attaching event listeners to new controller',
        );
        controller.addEventListener('playbackstatechange', onControllerEvent);
        controller.addEventListener('activated', onControllerEvent);
        controller.addEventListener('deactivated', onControllerEvent);
        controller.addEventListener('supportedkeyschange', onControllerEvent);
        controller.addEventListener('positionstatechange', onControllerEvent);
      } else {
        logger.debug('[controller] no controller');
        cachedActive = false;
        cachedPlaying = false;
        cachedCapabilities = {
          playPause: false,
          previousTrack: false,
          nextTrack: false,
          seekBackward: false,
          seekForward: false,
          seekTo: false,
        };
        cachedMetadata = null;
        tracker.destroy();
        pushFullState(null);
        return;
      }
    }

    if (!controller) return;

    cachedActive = controller.isActive ?? false;
    cachedPlaying = controller.isPlaying ?? false;
    cachedCapabilities = getCapabilities(controller);
    try {
      cachedMetadata = controller.getMetadata();
    } catch {
      cachedMetadata = null;
    }
    logger.debug('[controller] cached state:', {
      active: cachedActive,
      playing: cachedPlaying,
    });

    // Cache real position events into the tracker unconditionally, even
    // while nobody is tracking (popup closed). tracker.sync() only pushes
    // updates / starts RAF when the tracker itself is unpaused, and it
    // stays paused for as long as trackingEnabled is false (see
    // enableTracking/disableTracking below) - so this cannot start the
    // RAF loop for a hidden popup. It just means tracker.pos is real data
    // instead of null the next time tracking is enabled, instead of
    // silently dropping the only 'positionstatechange' event a page may
    // ever send for this playback session.
    if (
      event &&
      typeof event.duration === 'number' &&
      typeof event.position === 'number'
    ) {
      logger.debug('[controller] syncing from event', event);
      tracker.sync(event);
    }
    tracker.setPlaying(cachedPlaying);

    if (trackingEnabled) {
      const pos = tracker.pos
        ? { duration: tracker.pos.duration, position: tracker.pos.position }
        : null;
      pushFullState(pos);
    } else {
      pushFullState(null);
    }
  }

  function onControllerEvent(event: Event): void {
    logger.debug('[controller] onControllerEvent:', event.type, event);
    if (isDestroyed) return;
    if (event.type === 'positionstatechange') {
      refreshState(event as PositionStateEvent);
    } else {
      refreshState();
    }
  }

  refreshState();

  return {
    update(): void {
      refreshState();
    },
    destroy(): void {
      logger.debug('[controller] destroy');
      isDestroyed = true;
      tracker.destroy();
      if (controller) {
        controller.removeEventListener(
          'playbackstatechange',
          onControllerEvent,
        );
        controller.removeEventListener('activated', onControllerEvent);
        controller.removeEventListener('deactivated', onControllerEvent);
        controller.removeEventListener(
          'supportedkeyschange',
          onControllerEvent,
        );
        controller.removeEventListener(
          'positionstatechange',
          onControllerEvent,
        );
        controller = null;
      }
    },
    enableTracking(): void {
      logger.debug('[controller] enableTracking');
      if (isDestroyed || trackingEnabled) return;
      trackingEnabled = true;

      // tracker.pos already holds the latest 'positionstatechange' data
      // synced in refreshState() while tracking was off (see above) - no
      // separate resync needed here, resume() pushes from it directly.
      tracker.setPlaying(cachedPlaying);
      tracker.resume();
    },
    disableTracking(): void {
      logger.debug('[controller] disableTracking');
      if (isDestroyed || !trackingEnabled) return;
      trackingEnabled = false;
      tracker.pause();
    },
    primeSeek(position: number): void {
      logger.debug('[controller] primeSeek:', position);
      if (isDestroyed) return;

      const duration = tracker.pos?.duration ?? 0;
      const playbackRate = tracker.pos?.playbackRate ?? 1;
      tracker.sync({ duration, position, playbackRate });
    },
  };
}
