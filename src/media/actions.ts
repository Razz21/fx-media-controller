import { getController } from './controller';

export function getActiveController(tab: BrowserTab): MediaController | null {
  const controller = getController(tab);
  if (!controller?.isActive) return null;
  return controller;
}

export function toggleMediaController(tab: BrowserTab): void {
  const controller = getActiveController(tab);
  if (!controller) return;
  if (controller.isPlaying) {
    controller.pause();
  } else {
    controller.play();
  }
}

export function previousTrack(tab: BrowserTab): void {
  const controller = getActiveController(tab);
  if (!controller?.supportedKeys.includes('previoustrack')) return;
  controller.prevTrack();
}

export function nextTrack(tab: BrowserTab): void {
  const controller = getActiveController(tab);
  if (!controller?.supportedKeys.includes('nexttrack')) return;
  controller.nextTrack();
}

export function seekBackward(tab: BrowserTab): void {
  const controller = getActiveController(tab);
  if (!controller?.supportedKeys.includes('seekbackward')) return;
  controller.seekBackward(10);
}

export function seekForward(tab: BrowserTab): void {
  const controller = getActiveController(tab);
  if (!controller?.supportedKeys.includes('seekforward')) return;
  controller.seekForward(10);
}

export function seekToPosition(tab: BrowserTab, seconds: number): void {
  const controller = getActiveController(tab);
  if (!controller?.supportedKeys.includes('seekto')) return;
  controller.seekTo(seconds);
}
