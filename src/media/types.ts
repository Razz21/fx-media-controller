import type { TabMediaState } from './state';

export interface MediaControlPopup extends XULElement {
  state: 'closed' | 'open' | 'showing' | 'hiding';
  hidePopup(): void;
  openPopupAtScreen(x: number, y: number, isContextMenu: boolean): void;
  openPopup(
    anchor: Element,
    position?: string,
    x?: number,
    y?: number,
    isContextMenu?: boolean,
    attributesOverride?: boolean,
  ): void;
  moveToAnchor(anchor: Element, position: string, x?: number, y?: number): void;
}

export interface PopupElements {
  previous: XULElement;
  playPause: XULElement;
  playPauseSvg: SVGElement; // store the SVG element inside play/pause
  next: XULElement;
  seekBack: XULElement;
  seekFwd: XULElement;
  title: HTMLElement;
  artist: HTMLElement;
  artwork: HTMLImageElement;
  slider: HTMLInputElement;
  currentTime: HTMLElement;
  totalTime: HTMLElement;
}

export interface PopupTabState {
  tab: BrowserTab;
  unsubscribe: () => void;
  mediaState: TabMediaState;
}
