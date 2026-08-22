// GENERATED FILE — DO NOT EDIT
// Source: https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/chrome-webidl/MediaController.webidl

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

type AudioFocusLossReason = 'user' | 'system-transient' | 'system-permanent';

interface MediaController extends EventTarget {
  readonly id: number;
  readonly isActive: boolean;
  readonly isAudible: boolean;
  readonly isMuted: boolean;
  readonly isPlaying: boolean;
  readonly isAnyMediaBeingControlled: boolean;
  readonly playbackState: MediaSessionPlaybackState;
  readonly effectiveAudioSessionType: AudioSessionType;
  getMetadata(): MediaMetadataInit;
  readonly supportedKeys: readonly MediaControlKey[];
  onactivated: EventHandler;
  ondeactivated: EventHandler;
  onaudiblechange: EventHandler;
  oneffectiveaudiosessiontypechange: EventHandler;
  onmetadatachange: EventHandler;
  onplaybackstatechange: EventHandler;
  onpositionstatechange: EventHandler;
  onsupportedkeyschange: EventHandler;
  focus(): void;
  play(): void;
  pause(reason: AudioFocusLossReason): void;
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

declare namespace MediaControlService {
  function generateMediaControlKey(
    aKey: MediaControlKey,
    aSeekValue?: number,
  ): void;
  function getCurrentActiveMediaMetadata(): MediaMetadataInit;
  function getCurrentMediaSessionPlaybackState(): MediaSessionPlaybackState;
}
