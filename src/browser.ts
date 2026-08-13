import {
  destroyAllTabControls,
  handleTabLocationChange,
  handleTabOpen,
  handleTabClose,
  initializeTabControls,
} from './tabs';
import { logger } from './utils/logger';

export function initializeBrowserWindow(window: BrowserWindow): void {
  if (
    window.closed ||
    window.location.href !== 'chrome://browser/content/browser.xhtml' ||
    !window.gBrowser
  ) {
    return;
  }

  const gBrowser = window.gBrowser;

  const tabsProgressListener = {
    onLocationChange(browser: ChromeBrowser): void {
      try {
        handleTabLocationChange(gBrowser, browser);
      } catch (e) {
        logger.error(e);
      }
    },
  };

  gBrowser.addTabsProgressListener(tabsProgressListener);

  initializeTabControls(gBrowser, window);

  const onTabOpen = (event: Event): void => {
    const tab = event.target as BrowserTab;
    try {
      handleTabOpen(tab, window);
    } catch (e) {
      logger.error(e);
    }
  };

  const onTabClose = (event: Event): void => {
    const tab = event.target as BrowserTab;
    try {
      handleTabClose(tab, window);
    } catch (e) {
      logger.error(e);
    }
  };

  gBrowser.tabContainer.addEventListener('TabOpen', onTabOpen);
  gBrowser.tabContainer.addEventListener('TabClose', onTabClose);

  window.addEventListener(
    'unload',
    () => {
      try {
        gBrowser.removeTabsProgressListener?.(tabsProgressListener);
        gBrowser.tabContainer.removeEventListener('TabOpen', onTabOpen);
        gBrowser.tabContainer.removeEventListener('TabClose', onTabClose);
        destroyAllTabControls(gBrowser, window);
      } catch (e) {
        logger.error(e);
      }
    },
    { once: true },
  );
}
