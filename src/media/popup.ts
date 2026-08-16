import { getTabMediaState, destroyTabMediaState } from './state';
import {
  type MediaControllerState,
  hasActiveMediaController,
} from './controller';
import {
  nextTrack,
  previousTrack,
  seekBackward,
  seekForward,
  toggleMediaController,
  seekToPosition,
} from './actions';

import { ICONS, POPUP_CLASS, POPUP_ID } from './constants';
import type { MediaControlPopup, PopupElements, PopupTabState } from './types';
import { createIconButton, formatTime } from './utils';
import { hasAnyCapability } from './capabilities';
import { logger } from '../utils/logger';

export class MediaPopupManager {
  private window: BrowserWindow;
  private popup: MediaControlPopup | null = null;
  private elements: PopupElements | null = null;
  private state: PopupTabState | null = null;
  private hideTimer: number | null = null;
  private hoveredTab: BrowserTab | null = null;
  private mouseOverPopup = false;
  private currentDuration = 0;
  private isSeeking = false;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  private get document(): ChromeDocument {
    return this.window.document as ChromeDocument;
  }

  private ensurePopup(): void {
    if (this.popup) {
      logger.debug('[popup] ensurePopup: popup already exists');
      return;
    }

    logger.debug('[popup] ensurePopup: creating popup');
    const doc = this.document;

    const popup = doc.createXULElement('panel') as MediaControlPopup;
    popup.id = POPUP_ID;
    popup.className = POPUP_CLASS;
    popup.setAttribute('type', 'arrow');
    popup.setAttribute('norolluponanchor', 'true');
    popup.setAttribute('consumeoutsideclicks', 'false');
    popup.setAttribute('noautofocus', 'true');
    popup.setAttribute('level', 'top');
    popup.setAttribute('flip', 'both');
    popup.setAttribute('side', 'top');
    popup.setAttribute('position', 'bottomleft topleft');

    const interactiveDiv = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'div',
    );
    interactiveDiv.className = 'tab-preview-content-interactive';

    const mainDiv = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    mainDiv.className = 'tab-preview-content-main tab-media-control-content';

    // Metadata area
    const metaDiv = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    metaDiv.className = 'tab-media-metadata';

    const img = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'img',
    ) as HTMLImageElement;
    img.className = 'tab-media-artwork';
    img.hidden = true;
    img.setAttribute('alt', '');
    img.addEventListener('error', () => {
      img.hidden = true;
    });

    const textContainer = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'div',
    );
    textContainer.className = 'tab-media-text-container';

    const titleSpan = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'span',
    );
    titleSpan.className = 'tab-media-title';
    titleSpan.textContent = 'No media';

    const artistSpan = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'span',
    );
    artistSpan.className = 'tab-media-artist';
    artistSpan.textContent = '';

    textContainer.append(titleSpan, artistSpan);
    metaDiv.append(img, textContainer);

    const controlsDiv = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'div',
    );
    controlsDiv.className = 'tab-media-controls';

    const seekBack = createIconButton(
      doc,
      'tab-media-control-button tab-media-control-seekback',
      ICONS.seekBack,
      'Seek backward',
    );
    const prev = createIconButton(
      doc,
      'tab-media-control-button tab-media-control-previous',
      ICONS.previous,
      'Previous track',
    );
    const play = createIconButton(
      doc,
      'tab-media-control-button tab-media-control-playpause',
      ICONS.play,
      'Play/Pause',
    );
    const next = createIconButton(
      doc,
      'tab-media-control-button tab-media-control-next',
      ICONS.next,
      'Next track',
    );
    const seekFwd = createIconButton(
      doc,
      'tab-media-control-button tab-media-control-seekfwd',
      ICONS.seekFwd,
      'Seek forward',
    );

    controlsDiv.append(
      seekBack.button,
      prev.button,
      play.button,
      next.button,
      seekFwd.button,
    );

    // Progress area
    const progressDiv = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'div',
    );
    progressDiv.className = 'tab-media-progress';

    const currentTimeSpan = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'span',
    );
    currentTimeSpan.classList.add('tab-media-time', 'tab-media-time-current');
    currentTimeSpan.textContent = '0:00';

    const totalTimeSpan = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'span',
    );
    totalTimeSpan.classList.add('tab-media-time', 'tab-media-time-total');
    totalTimeSpan.textContent = '0:00';

    const slider = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      'input',
    ) as HTMLInputElement;
    slider.type = 'range';
    slider.className = 'tab-media-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = '0';
    slider.step = '0.1';
    slider.disabled = true;

    slider.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.cancelHide();
    });

    slider.addEventListener('input', (e) => {
      e.stopPropagation();

      if (!this.isSeeking) {
        this.isSeeking = true;
        this.state?.mediaState.disableTracking();
        logger.debug('[popup] seek start, tracking disabled');
      }

      if (this.elements) {
        const percent = parseFloat(slider.value) / 100;
        const currentTime = percent * this.currentDuration;
        this.elements.currentTime.textContent = formatTime(currentTime);
      }
    });

    slider.addEventListener('change', (e) => {
      e.stopPropagation();
      if (!this.state) return;
      const val = parseFloat(slider.value);
      const duration = this.currentDuration;
      if (!duration || duration <= 0) return;
      const seekTime = (val / 100) * duration;

      seekToPosition(this.state.tab, seekTime);

      this.isSeeking = false;
      this.state.mediaState.primeSeek(seekTime);
      this.state.mediaState.enableTracking();
      logger.debug('[popup] seek ended, tracking re-enabled');
    });

    progressDiv.append(currentTimeSpan, slider, totalTimeSpan);

    mainDiv.append(metaDiv, controlsDiv, progressDiv);
    interactiveDiv.appendChild(mainDiv);
    popup.appendChild(interactiveDiv);

    popup.addEventListener('mouseenter', () => {
      logger.debug('[popup] popup mouseenter');
      this.mouseOverPopup = true;
      this.cancelHide();
    });
    popup.addEventListener('mouseleave', () => {
      logger.debug('[popup] popup mouseleave');
      this.mouseOverPopup = false;
      this.scheduleHide();
    });

    seekBack.button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.state) return;
      try {
        seekBackward(this.state.tab);
      } catch (err) {
        logger.error(err);
      }
    });
    prev.button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.state) return;
      try {
        previousTrack(this.state.tab);
      } catch (err) {
        logger.error(err);
      }
    });
    play.button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.state) return;
      try {
        toggleMediaController(this.state.tab);
      } catch (err) {
        logger.error(err);
      }
    });
    next.button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.state) return;
      try {
        nextTrack(this.state.tab);
      } catch (err) {
        logger.error(err);
      }
    });
    seekFwd.button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.state) return;
      try {
        seekForward(this.state.tab);
      } catch (err) {
        logger.error(err);
      }
    });

    const popupSet = doc.getElementById('mainPopupSet');
    if (!popupSet) throw new Error('Firefox #mainPopupSet not found');
    popupSet.appendChild(popup);

    this.popup = popup;
    this.elements = {
      previous: prev.button,
      playPause: play.button,
      playPauseSvg: play.svg,
      next: next.button,
      seekBack: seekBack.button,
      seekFwd: seekFwd.button,
      title: titleSpan,
      artist: artistSpan,
      artwork: img,
      slider,
      currentTime: currentTimeSpan,
      totalTime: totalTimeSpan,
    };
    logger.debug('[popup] ensurePopup: popup created and appended');
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) {
      this.window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private scheduleHide(delay = 300): void {
    this.cancelHide();
    this.hideTimer = this.window.setTimeout(() => {
      this.hideTimer = null;
      if (!this.mouseOverPopup && !this.hoveredTab) {
        this.hidePopup();
      }
    }, delay);
  }

  private teardownActiveTab(): void {
    if (this.state) {
      this.state.mediaState.disableTracking();
      this.state.unsubscribe();
      this.state = null;
    }
    if (this.popup && this.popup.state !== 'closed') {
      this.popup.hidePopup();
      logger.debug('[popup] panel hidden (teardown)');
    }
  }

  private hidePopup(): void {
    logger.debug('[popup] hidePopup called');
    this.teardownActiveTab();
    this.hoveredTab = null;
    this.mouseOverPopup = false;
    this.cancelHide();
    this.isSeeking = false;
  }

  private updateStructuralUI(state: MediaControllerState): boolean {
    logger.debug('[popup] updateStructuralUI called with state:', state);
    if (!this.elements) {
      logger.debug('[popup] updateStructuralUI: elements null');
      return false;
    }

    const { capabilities, playing, active, metadata, position } = state;
    logger.debug('[popup] updateStructuralUI state:', {
      active,
      playing,
      capabilities,
    });

    if (metadata) {
      const { title = 'Untitled', artist = '', artwork } = metadata ?? {};
      this.elements.title.textContent = title;
      this.elements.title.title = title;
      this.elements.artist.textContent = artist;
      this.elements.artist.hidden = !artist;
      const artworkData = artwork && artwork.length > 0 ? artwork[0] : null;
      if (artworkData && artworkData.src) {
        this.elements.artwork.src = artworkData.src;
        this.elements.artwork.hidden = false;
      } else {
        this.elements.artwork.hidden = true;
      }
    } else {
      this.elements.title.textContent = 'No media';
      this.elements.artist.textContent = '';
      this.elements.artist.hidden = true;
      this.elements.artwork.hidden = true;
    }

    if (playing) {
      this.elements.playPauseSvg.innerHTML = ICONS.pause;
    } else {
      this.elements.playPauseSvg.innerHTML = ICONS.play;
    }

    const hasControls = active && hasAnyCapability(capabilities);

    logger.debug(`[popup] updateStructuralUI: hasControls = ${hasControls}`);

    this.elements.seekBack.disabled =
      !hasControls || !capabilities.seekBackward;
    this.elements.previous.disabled =
      !hasControls || !capabilities.previousTrack;
    this.elements.playPause.disabled = !hasControls || !capabilities.playPause;
    this.elements.next.disabled = !hasControls || !capabilities.nextTrack;
    this.elements.seekFwd.disabled = !hasControls || !capabilities.seekForward;

    this.applyPositionToDOM(hasControls, capabilities.seekTo, position);

    return hasControls;
  }

  private updatePositionUI(state: MediaControllerState): void {
    if (!this.elements) return;
    const { active, capabilities, position } = state;
    const hasControls = active && hasAnyCapability(capabilities);
    this.applyPositionToDOM(hasControls, capabilities.seekTo, position);
  }

  private applyPositionToDOM(
    hasControls: boolean,
    seekTo: boolean,
    position: { duration: number; position: number } | null,
  ): void {
    if (!this.elements) return;
    const sliderEnabled =
      hasControls && seekTo && position && position.duration > 0;
    if (sliderEnabled && position) {
      const percent = (position.position / position.duration) * 100;
      this.elements.slider.value = String(Math.min(100, Math.max(0, percent)));
      this.elements.slider.disabled = false;
      this.elements.currentTime.textContent = formatTime(position.position);
      this.elements.totalTime.textContent = formatTime(position.duration);
      this.currentDuration = position.duration;
      logger.debug('[popup] slider updated to', this.elements.slider.value);
    } else {
      this.elements.slider.value = '0';
      this.elements.slider.disabled = true;
      this.elements.currentTime.textContent = '0:00';
      this.elements.totalTime.textContent = '0:00';
    }
  }

  private showPopupForTab(tab: BrowserTab): void {
    logger.debug('[popup] showPopupForTab called for tab', tab);
    if (tab.closed) {
      logger.debug('[popup] tab closed, abort');
      return;
    }

    this.ensurePopup();
    this.cancelHide();

    this.teardownActiveTab();

    const state = getTabMediaState(tab);
    logger.debug('[popup] got TabMediaState for tab');

    const onStructuralChange = (mediaState: MediaControllerState): void => {
      if (this.isSeeking) {
        logger.debug('[popup] structural push ignored (isSeeking)');
        return;
      }

      logger.debug('[popup] structural callback fired with state:', mediaState);
      try {
        const hasControls = this.updateStructuralUI(mediaState);
        if (hasControls) {
          logger.debug(
            '[popup] hasControls = true, resuming binding and opening popup',
          );
          state.enableTracking();
          if (this.popup) {
            if (this.popup.state !== 'open') {
              this.popup.openPopup(
                tab,
                'bottomleft topleft',
                0,
                2,
                false,
                false,
              );
              logger.debug('[popup] popup opened');
            } else {
              this.popup.moveToAnchor(tab, 'bottomleft topleft', 0, 2);
              logger.debug('[popup] popup moved to anchor');
            }
          } else {
            logger.debug('[popup] this.popup is null!');
          }
        } else {
          logger.debug(
            '[popup] hasControls = false, pausing binding and hiding popup',
          );
          state.disableTracking();
          logger.debug('[popup] hide check, popup.state=', this.popup?.state);
          if (this.popup && this.popup.state !== 'closed') {
            this.popup.hidePopup();
            logger.debug('[popup] popup hidden because no controls');
          }
        }
      } catch (err) {
        logger.error('[popup] structural callback error:', err);
      }
    };

    const onPositionTick = (mediaState: MediaControllerState): void => {
      if (this.isSeeking) return;
      this.updatePositionUI(mediaState);
    };

    const unsubscribe = state.subscribe(onStructuralChange, onPositionTick);

    this.state = {
      tab,
      unsubscribe,
      mediaState: state,
    };
    logger.debug('[popup] state set, subscription active');
  }

  onTabMouseEnter(tab: BrowserTab): void {
    logger.debug('[popup] onTabMouseEnter for tab', tab);
    if (tab.closed) return;
    if (this.hoveredTab === tab) {
      this.cancelHide();
      return;
    }

    this.hoveredTab = tab;
    this.cancelHide();

    if (!hasActiveMediaController(tab)) {
      logger.debug('[popup] tab has no active media, not opening popup');
      this.teardownActiveTab();
      return;
    }

    this.showPopupForTab(tab);
  }

  onTabMouseLeave(): void {
    logger.debug('[popup] onTabMouseLeave');
    this.hoveredTab = null;
    if (this.mouseOverPopup) return;
    this.scheduleHide();
  }

  onTabClose(tab: BrowserTab): void {
    logger.debug('[popup] onTabClose for tab', tab);
    if (this.state && this.state.tab === tab) {
      this.state.mediaState.disableTracking();
      this.state.unsubscribe();
      this.state = null;
      this.hoveredTab = null;
      this.hidePopup();
    }
    destroyTabMediaState(tab);
  }

  destroy(): void {
    logger.debug('[popup] destroy');
    this.cancelHide();
    if (this.state) {
      this.state.mediaState.disableTracking();
      this.state.unsubscribe();
      this.state = null;
    }
    this.hoveredTab = null;
    this.mouseOverPopup = false;
    this.isSeeking = false;
    this.popup?.remove();
    this.popup = null;
    this.elements = null;
  }
}

// Per-window manager storage
const managers = new WeakMap<BrowserWindow, MediaPopupManager>();

export function getPopupManager(window: BrowserWindow): MediaPopupManager {
  let mgr = managers.get(window);
  if (!mgr) {
    mgr = new MediaPopupManager(window);
    managers.set(window, mgr);
  }
  return mgr;
}

export function destroyPopupManager(window: BrowserWindow): void {
  const mgr = managers.get(window);
  if (mgr) {
    mgr.destroy();
    managers.delete(window);
  }
}
