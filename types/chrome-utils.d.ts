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

declare namespace ChromeUtils {
  function importESModule<T = Record<string, unknown>>(url: string): T;
}

interface ConsoleAPIOptions {
  prefix?: string;
  maxLogLevel?: 'debug' | 'log' | 'info' | 'warn' | 'error';
  maxLogLevelPref?: string;
}

interface ConsoleAPI {
  debug(...args: unknown[]): void;
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

interface ConsoleAPIConstructor {
  new (options?: ConsoleAPIOptions): ConsoleAPI;
}

declare function dump(message: string): void;
