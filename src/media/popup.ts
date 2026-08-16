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
import { createElementFactory, createIconButton, formatTime } from './utils';
import { hasAnyCapability } from './capabilities';
import { logger } from '../utils/logger';

const XHTML_TEXT = {
  noMedia: 'No media',
  zeroTime: '0:00',
} as const;

type Capabilities = MediaControllerState['capabilities'];

const CONTROL_BUTTONS: Array<{
  elementKey: 'seekBack' | 'previous' | 'playPause' | 'next' | 'seekFwd';
  className: string;
  icon: string;
  label: string;
  capability: keyof Capabilities;
  action: (tab: BrowserTab) => void;
}> = [
  {
    elementKey: 'seekBack',
    className: 'tab-media-control-button tab-media-control-seekback',
    icon: ICONS.seekBack,
    label: 'Seek backward',
    capability: 'seekBackward',
    action: seekBackward,
  },
  {
    elementKey: 'previous',
    className: 'tab-media-control-button tab-media-control-previous',
    icon: ICONS.previous,
    label: 'Previous track',
    capability: 'previousTrack',
    action: previousTrack,
  },
  {
    elementKey: 'playPause',
    className: 'tab-media-control-button tab-media-control-playpause',
    icon: ICONS.play,
    label: 'Play/Pause',
    capability: 'playPause',
    action: toggleMediaController,
  },
  {
    elementKey: 'next',
    className: 'tab-media-control-button tab-media-control-next',
    icon: ICONS.next,
    label: 'Next track',
    capability: 'nextTrack',
    action: nextTrack,
  },
  {
    elementKey: 'seekFwd',
    className: 'tab-media-control-button tab-media-control-seekfwd',
    icon: ICONS.seekFwd,
    label: 'Seek forward',
    capability: 'seekForward',
    action: seekForward,
  },
];

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
  private infoButton: XULElement | null = null;
  private infoPopoverEl: HTMLElement | null = null;
  private infoPopoverOpen = false;

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
    const h = createElementFactory(doc);

    const popup = this.createPopupPanel(doc);
    const interactiveDiv = h('div', 'tab-preview-content-interactive');
    const mainDiv = h(
      'div',
      'tab-preview-content-main tab-media-control-content',
    );

    const { metaDiv, img, titleSpan, artistSpan } =
      this.buildMetadataSection(h);
    const { controlsDiv, controlEls } = this.buildControlsSection(doc, h);
    const { progressDiv, currentTimeSpan, totalTimeSpan, slider } =
      this.buildProgressSection(h);

    mainDiv.append(metaDiv, controlsDiv, progressDiv);

    const { infoButton, infoPopover } = this.buildInfoSection(doc, h);

    interactiveDiv.append(mainDiv, infoButton, infoPopover);
    popup.appendChild(interactiveDiv);

    this.infoButton = infoButton;
    this.infoPopoverEl = infoPopover;

    this.wirePopupChromeEvents(popup);

    const popupSet = doc.getElementById('mainPopupSet');
    if (!popupSet) throw new Error('Firefox #mainPopupSet not found');
    popupSet.appendChild(popup);

    this.popup = popup;
    this.elements = {
      previous: controlEls.previous.button,
      playPause: controlEls.playPause.button,
      playPauseSvg: controlEls.playPause.svg,
      next: controlEls.next.button,
      seekBack: controlEls.seekBack.button,
      seekFwd: controlEls.seekFwd.button,
      title: titleSpan,
      artist: artistSpan,
      artwork: img,
      slider,
      currentTime: currentTimeSpan,
      totalTime: totalTimeSpan,
    };
    logger.debug('[popup] ensurePopup: popup created and appended');
  }

  private createPopupPanel(doc: ChromeDocument): MediaControlPopup {
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
    return popup;
  }

  private buildMetadataSection(h: ReturnType<typeof createElementFactory>): {
    metaDiv: HTMLElement;
    img: HTMLImageElement;
    titleSpan: HTMLElement;
    artistSpan: HTMLElement;
  } {
    const metaDiv = h('div', 'tab-media-metadata');

    const img = h('img', 'tab-media-artwork');
    img.hidden = true;
    img.setAttribute('alt', '');
    img.addEventListener('error', () => {
      img.hidden = true;
    });

    const textContainer = h('div', 'tab-media-text-container');

    const titleSpan = h('span', 'tab-media-title');
    titleSpan.textContent = XHTML_TEXT.noMedia;

    const artistSpan = h('span', 'tab-media-artist');
    artistSpan.textContent = '';

    textContainer.append(titleSpan, artistSpan);
    metaDiv.append(img, textContainer);

    return { metaDiv, img, titleSpan, artistSpan };
  }

  private buildControlsSection(
    doc: ChromeDocument,
    h: ReturnType<typeof createElementFactory>,
  ): {
    controlsDiv: HTMLElement;
    controlEls: Record<
      (typeof CONTROL_BUTTONS)[number]['elementKey'],
      { button: XULElement; svg: SVGElement }
    >;
  } {
    const controlsDiv = h('div', 'tab-media-controls');

    const controlEls = {} as Record<
      (typeof CONTROL_BUTTONS)[number]['elementKey'],
      { button: XULElement; svg: SVGElement }
    >;

    for (const cfg of CONTROL_BUTTONS) {
      const built = createIconButton(doc, cfg.className, cfg.icon, cfg.label);
      built.button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.state) return;
        try {
          cfg.action(this.state.tab);
        } catch (err) {
          logger.error(err);
        }
      });
      controlEls[cfg.elementKey] = built;
      controlsDiv.appendChild(built.button);
    }

    return { controlsDiv, controlEls };
  }

  private buildProgressSection(h: ReturnType<typeof createElementFactory>): {
    progressDiv: HTMLElement;
    currentTimeSpan: HTMLElement;
    totalTimeSpan: HTMLElement;
    slider: HTMLInputElement;
  } {
    const progressDiv = h('div', 'tab-media-progress');

    const currentTimeSpan = h('span', 'tab-media-time tab-media-time-current');
    currentTimeSpan.textContent = XHTML_TEXT.zeroTime;

    const totalTimeSpan = h('span', 'tab-media-time tab-media-time-total');
    totalTimeSpan.textContent = XHTML_TEXT.zeroTime;

    const slider = h('input', 'tab-media-slider');
    slider.type = 'range';
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

    return { progressDiv, currentTimeSpan, totalTimeSpan, slider };
  }

  private buildInfoSection(
    doc: ChromeDocument,
    h: ReturnType<typeof createElementFactory>,
  ): { infoButton: XULElement; infoPopover: HTMLElement } {
    const info = createIconButton(
      doc,
      'tab-media-control-button tab-media-info-button',
      ICONS.info,
      'About',
    );
    info.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleInfoPopover();
    });

    const infoPopover = h('div', 'tab-media-info-popover');
    infoPopover.hidden = true;

    const infoName = h('div', 'tab-media-info-name');
    infoName.textContent = __FXMC_PROJECT_NAME__;

    const infoVersion = h('div', 'tab-media-info-version');
    infoVersion.textContent = `Version: ${__FXMC_VERSION__}`;

    const infoLink = h('a', 'tab-media-info-link');
    infoLink.textContent = 'View on GitHub';
    infoLink.href = __FXMC_REPO_URL__ || '#';
    infoLink.addEventListener('mousedown', (e) => e.stopPropagation());
    if (__FXMC_REPO_URL__) {
      infoLink.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.window.open(__FXMC_REPO_URL__, '_blank', 'noopener');
        this.closeInfoPopover();
      });
    } else {
      infoLink.addEventListener('click', (e) => e.preventDefault());
    }

    infoPopover.append(infoName, infoVersion, infoLink);

    return { infoButton: info.button, infoPopover };
  }

  private wirePopupChromeEvents(popup: MediaControlPopup): void {
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
    popup.addEventListener('click', (e) => {
      if (!this.infoPopoverOpen) return;
      const target = e.target as Node;
      if (this.infoButton?.contains(target)) return;
      if (this.infoPopoverEl?.contains(target)) return;
      this.closeInfoPopover();
    });
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

  private disposeMediaState(): void {
    if (!this.state) return;
    this.state.mediaState.disableTracking();
    this.state.unsubscribe();
    this.state = null;
  }

  private teardownActiveTab(): void {
    this.closeInfoPopover();
    this.disposeMediaState();
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

  private toggleInfoPopover(): void {
    if (this.infoPopoverOpen) {
      this.closeInfoPopover();
    } else {
      this.openInfoPopover();
    }
  }

  private openInfoPopover(): void {
    if (!this.infoPopoverEl) return;
    this.infoPopoverEl.hidden = false;
    this.infoPopoverOpen = true;
  }

  private closeInfoPopover(): void {
    if (!this.infoPopoverEl) return;
    this.infoPopoverEl.hidden = true;
    this.infoPopoverOpen = false;
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
      this.elements.title.textContent = XHTML_TEXT.noMedia;
      this.elements.artist.textContent = '';
      this.elements.artist.hidden = true;
      this.elements.artwork.hidden = true;
    }

    this.elements.playPauseSvg.innerHTML = playing ? ICONS.pause : ICONS.play;

    const hasControls = active && hasAnyCapability(capabilities);
    logger.debug(`[popup] updateStructuralUI: hasControls = ${hasControls}`);

    for (const cfg of CONTROL_BUTTONS) {
      this.elements[cfg.elementKey].disabled =
        !hasControls || !capabilities[cfg.capability];
    }

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
    } else {
      this.elements.slider.value = '0';
      this.elements.slider.disabled = true;
      this.elements.currentTime.textContent = XHTML_TEXT.zeroTime;
      this.elements.totalTime.textContent = XHTML_TEXT.zeroTime;
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
      this.disposeMediaState();
      this.hoveredTab = null;
      this.hidePopup();
    }
    destroyTabMediaState(tab);
  }

  destroy(): void {
    logger.debug('[popup] destroy');
    this.cancelHide();
    this.disposeMediaState();
    this.hoveredTab = null;
    this.mouseOverPopup = false;
    this.isSeeking = false;
    this.infoPopoverOpen = false;
    this.infoButton = null;
    this.infoPopoverEl = null;
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
