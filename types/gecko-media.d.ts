/**
 * Minimal Gecko type declarations used by Firefox.
 *
 * Sources:
 * - Mozilla Firefox:
 *   https://searchfox.org/firefox-main/source/devtools/client/performance-new/@types/gecko.d.ts
 *
 * - Mozilla Gecko WebIDL:
 *   https://searchfox.org/firefox-main/source/dom/chrome-webidl/MediaController.webidl
 *
 */

type EventHandler = ((this: EventTarget, ev: Event) => unknown) | null;

/**
 * Shape observed at runtime on the Event object dispatched for
 * 'positionstatechange' - duration/position/playbackRate arrive as own
 * properties on the event (see console captures). Not a separate type in
 * MediaController.webidl itself:
 * https://searchfox.org/firefox-main/source/dom/chrome-webidl/MediaController.webidl
 * - confirmed empirically, not from a WebIDL dictionary definition. Verify
 * against MediaController.cpp / MediaControlEventTargetSource if this ever
 * needs to be guaranteed rather than observed.
 */
interface PositionStateEvent extends Event {
  readonly duration: number;
  readonly position: number;
  readonly playbackRate: number;
}

interface AudioSessionType {}

interface MediaController extends EventTarget {
  readonly id: number;
  readonly isActive: boolean;
  readonly isAudible: boolean;
  readonly isMuted: boolean;
  readonly isPlaying: boolean;
  readonly isAnyMediaBeingControlled: boolean;
  readonly playbackState: MediaSessionPlaybackState;
  readonly effectiveAudioSessionType: AudioSessionType;
  readonly supportedKeys: readonly MediaControlKey[];

  getMetadata(): MediaMetadataInit;

  onactivated: EventHandler;
  onaudiblechange: EventHandler;
  ondeactivated: EventHandler;
  oneffectiveaudiosessiontypechange: EventHandler;
  onmetadatachange: EventHandler;
  onplaybackstatechange: EventHandler;
  onpositionstatechange: EventHandler; // Already present
  onsupportedkeyschange: EventHandler;

  focus(): void;
  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  mute(): void;
  unmute(): void;
  prevTrack(): void;
  nextTrack(): void;
  seekBackward(seekOffset: number): void;
  seekForward(seekOffset: number): void;
  skipAd(): void;
  seekTo(seekTime: number, fastSeek?: boolean): void;
}

type MediaControlKey =
  | 'focus'
  | 'play'
  | 'pause'
  | 'playpause'
  | 'previoustrack'
  | 'nexttrack'
  | 'seekbackward'
  | 'seekforward'
  | 'skipad'
  | 'seekto'
  | 'stop'
  | 'mute'
  | 'unmute'
  | 'setvolume';

interface MediaControllerEventMap {
  activated: Event;
  audiblechange: Event;
  deactivated: Event;
  effectiveaudiosessiontypechange: Event;
  metadatachange: Event;
  playbackstatechange: Event;
  positionstatechange: PositionStateEvent;
  supportedkeyschange: Event;
}
interface MediaController extends EventTarget {
  addEventListener<K extends keyof MediaControllerEventMap>(
    type: K,
    listener: (
      this: MediaController,
      event: MediaControllerEventMap[K],
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener<K extends keyof MediaControllerEventMap>(
    type: K,
    listener: (
      this: MediaController,
      event: MediaControllerEventMap[K],
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}
