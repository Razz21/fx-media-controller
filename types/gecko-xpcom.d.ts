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

interface XPCOMClass {
  getService<T = unknown>(interfaceType: unknown): T;
  createInstance<T = unknown>(interfaceType?: unknown): T;
}

interface ComponentsClasses {
  [contractId: string]: XPCOMClass;
}

interface ComponentsInterfaces {
  nsIWindowMediator: unknown;
  nsIObserverService: unknown;
  nsIFile: unknown;
  nsIProperties: unknown;
  nsIIOService: unknown;
  mozIJSSubScriptLoader: unknown;
}

interface ComponentsUtils {
  reportError(error: unknown): void;
}

interface ComponentsGlobal {
  classes: ComponentsClasses;
  interfaces: ComponentsInterfaces;
  utils: ComponentsUtils;
}

declare const Components: ComponentsGlobal;

/* -------------------------------------------------------------------------
 * XPCOM services used by autoconfig.cfg
 * ------------------------------------------------------------------------- */

interface WindowMediator {
  getMostRecentWindow(
    windowType: 'navigator:browser' | string,
  ): BrowserWindow | null;
}

interface ObserverService {
  addObserver(observer: nsIObserver, topic: string): void;

  removeObserver?(observer: nsIObserver, topic: string): void;
}

interface nsIObserver {
  observe(subject: unknown, topic: string, data?: string): void;
}

/* -------------------------------------------------------------------------
 * DOM extensions used by the feature
 * ------------------------------------------------------------------------- */

interface ChromeDocument extends Document {
  createXULElement(type: string): XULElement;
}

interface XULElement extends HTMLElement {
  ownerDocument: ChromeDocument;
  disabled?: boolean;
  hidePopup(): void;

  openPopupAtScreen(x: number, y: number, isContextMenu: boolean): void;
}
