import type { MediaControllerCapabilities } from './controller';

export function hasAnyCapability(
  capabilities: MediaControllerCapabilities,
): boolean {
  return (
    capabilities.playPause ||
    capabilities.previousTrack ||
    capabilities.nextTrack ||
    capabilities.seekBackward ||
    capabilities.seekForward ||
    capabilities.seekTo
  );
}
