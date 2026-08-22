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
