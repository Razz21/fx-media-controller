import { initializeBrowserWindow } from './browser';
import { logger } from './utils/logger';

const Cc = Components.classes;
const Ci = Components.interfaces;

const windowMediator = Cc[
  '@mozilla.org/appshell/window-mediator;1'
].getService<WindowMediator>(Ci.nsIWindowMediator);

function initialize(window: BrowserWindow | null): void {
  if (!window || window.closed) {
    return;
  }

  try {
    initializeBrowserWindow(window);
  } catch (error) {
    logger.error(`TabPlayPause initialize error: ${error}`);
  }
}

initialize(windowMediator.getMostRecentWindow('navigator:browser'));

const observer: nsIObserver = {
  observe(subject: unknown, topic: string): void {
    if (topic !== 'domwindowopened') {
      return;
    }

    const window = subject as BrowserWindow;

    window.addEventListener('load', function onLoad(): void {
      window.removeEventListener('load', onLoad);

      initialize(window);
    });
  },
};

Cc['@mozilla.org/observer-service;1']
  .getService<ObserverService>(Ci.nsIObserverService)
  .addObserver(observer, 'domwindowopened');
