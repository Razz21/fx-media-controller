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

interface BrowsingContext {
  readonly id: number;
  readonly browserId: number;
  readonly mediaController?: MediaController | null;
}

interface ChromeBrowser {
  readonly browserId: number;
  readonly browsingContext?: BrowsingContext | null;
  readonly currentURI: {
    spec: string;
  };
}

interface BrowserTab extends HTMLElement {
  readonly linkedBrowser: ChromeBrowser;

  /**
   * Firefox internally exposes arbitrary properties on tab elements.
   */
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------
 * gBrowser
 * ------------------------------------------------------------------------- */

interface TabsProgressListener {
  onLocationChange(
    browser: ChromeBrowser,
    webProgress?: unknown,
    request?: unknown,
    location?: unknown,
    flags?: number,
  ): void;
}

interface FirefoxTabContainerEventMap extends HTMLElementEventMap {
  TabOpen: Event & {
    target: BrowserTab;
  };
}

interface TabContainer extends HTMLElement {}

interface Browser {
  readonly tabs: BrowserTab[];
  readonly selectedTab: BrowserTab;
  readonly tabContainer: TabContainer;

  getTabForBrowser(browser: ChromeBrowser): BrowserTab | null;

  addTabsProgressListener(listener: TabsProgressListener): void;

  removeTabsProgressListener?(listener: TabsProgressListener): void;
}

/* -------------------------------------------------------------------------
 * Browser window
 * ------------------------------------------------------------------------- */

interface BrowserWindow extends Window {
  readonly gBrowser: Browser;
}
