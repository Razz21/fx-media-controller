import { getTabMediaState } from './media/state';
import { type MediaControllerState } from './media/controller';
import { toggleMediaController } from './media/actions';
import { logger } from './utils/logger';
import { ICONS } from './media/constants';

const bindings = new WeakMap<HTMLElement, () => void>();
const svgElements = new WeakMap<HTMLElement, SVGElement>();

function updateButton(button: HTMLElement, state: MediaControllerState): void {
  button.hidden = !state.active;
  const svg = svgElements.get(button);
  if (svg) {
    svg.innerHTML = state.playing ? ICONS.pause : ICONS.play;
  } else {
    button.textContent = state.playing ? '⏸' : '▶';
  }
}

function createButton(document: ChromeDocument): HTMLElement {
  const button = document.createElementNS(
    'http://www.w3.org/1999/xhtml',
    'moz-button',
  ) as HTMLElement;
  button.setAttribute('type', 'icon');
  button.setAttribute('size', 'small');
  button.setAttribute('tabindex', '-1');
  button.setAttribute('class', 'tab-playpause-button');
  button.setAttribute('aria-label', 'Play/Pause');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.innerHTML = ICONS.play;
  button.appendChild(svg);

  svgElements.set(button, svg);

  return button;
}

export function createTabPlayPauseButton(tab: BrowserTab): HTMLElement | null {
  if (tab.querySelector('.tab-playpause-button')) return null;
  const audioButton = tab.querySelector('.tab-audio-button');
  if (!audioButton) return null;

  const button = createButton(tab.ownerDocument as ChromeDocument);
  // No text content needed; SVG is used
  button.hidden = true;

  button.addEventListener('mousedown', (e) => e.stopPropagation());
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      toggleMediaController(tab);
    } catch (err) {
      logger.error(err);
    }
  });

  audioButton.parentNode?.insertBefore(button, audioButton);

  const state = getTabMediaState(tab);
  const unsubscribe = state.subscribe((mediaState) => {
    updateButton(button, mediaState);
  });
  bindings.set(button, unsubscribe);

  return button;
}

export function destroyTabPlayPauseButton(tab: BrowserTab): void {
  const button = tab.querySelector(
    '.tab-playpause-button',
  ) as HTMLElement | null;
  if (!button) return;

  const unsubscribe = bindings.get(button);
  if (unsubscribe) {
    unsubscribe();
    bindings.delete(button);
  }

  svgElements.delete(button);

  button.remove();
}
