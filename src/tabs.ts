import { createTabPlayPauseButton, destroyTabPlayPauseButton } from './button';
import { getPopupManager, destroyPopupManager } from './media/popup';
import { destroyTabMediaState } from './media/state';
import type { MediaPopupManager } from './media/popup';
import { logger } from './utils/logger';

const attachedTabs = new WeakSet<BrowserTab>();

function attachTabEvents(tab: BrowserTab, popupMgr: MediaPopupManager): void {
  if (attachedTabs.has(tab)) return;
  attachedTabs.add(tab);

  tab.addEventListener('mouseenter', () => {
    try {
      popupMgr.onTabMouseEnter(tab);
    } catch (e) {
      logger.error(e);
    }
  });
  tab.addEventListener('mouseleave', () => {
    try {
      popupMgr.onTabMouseLeave();
    } catch (e) {
      logger.error(e);
    }
  });
}

function detachTabEvents(tab: BrowserTab): void {
  // We don't remove listeners explicitly; the tab will be destroyed.
  // Just remove from the set to avoid re‑attaching if the tab is reused (unlikely).
  attachedTabs.delete(tab);
}

export function initializeTabControls(
  gBrowser: Browser,
  window: BrowserWindow,
): void {
  const popupMgr = getPopupManager(window);
  for (const tab of gBrowser.tabs) {
    createTabPlayPauseButton(tab);
    attachTabEvents(tab, popupMgr);
  }
}

export function destroyAllTabControls(
  gBrowser: Browser,
  window: BrowserWindow,
): void {
  for (const tab of gBrowser.tabs) {
    destroyTabPlayPauseButton(tab);
    destroyTabMediaState(tab);
    detachTabEvents(tab);
  }
  destroyPopupManager(window);
}

export function handleTabOpen(tab: BrowserTab, window: BrowserWindow): void {
  createTabPlayPauseButton(tab);
  const popupMgr = getPopupManager(window);
  attachTabEvents(tab, popupMgr);
}

export function handleTabClose(tab: BrowserTab, window: BrowserWindow): void {
  const popupMgr = getPopupManager(window);
  popupMgr.onTabClose(tab);
  destroyTabPlayPauseButton(tab);
  detachTabEvents(tab);
}

export function handleTabLocationChange(
  gBrowser: Browser,
  browser: ChromeBrowser,
): void {
  const tab = gBrowser.getTabForBrowser(browser);
  logger.debug('[tabs] handleTabLocationChange', {
    tab,
    spec: browser.currentURI?.spec,
  });
  if (!tab) return;
  // Ensure the play/pause button exists
  const button = tab.querySelector('.tab-playpause-button');
  if (!button) {
    createTabPlayPauseButton(tab);
  }
  // The media state subscription will automatically update the button and popup.
  // No explicit update call needed.
}
