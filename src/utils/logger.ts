const proxyLogger = () =>
  new Proxy({} as ConsoleAPI, {
    get() {
      return () => {};
    },
  });

const logDump = (message: string): void => {
  if (typeof dump === 'function') {
    dump(message);
  }
};

function createLogger(): ConsoleAPI {
  if (typeof ChromeUtils === 'undefined') {
    return proxyLogger();
  }

  try {
    const { ConsoleAPI } = ChromeUtils.importESModule<{
      ConsoleAPI?: ConsoleAPIConstructor;
    }>('resource://gre/modules/Console.sys.mjs');

    if (!ConsoleAPI) {
      logDump(`[FX Media Controller] ConsoleAPI is not available\n`);
      return proxyLogger();
    }

    return new ConsoleAPI({
      prefix: 'FX Media Controller',
      maxLogLevel: __FXMC_LOG_LEVEL__,
    });
  } catch (error) {
    logDump(
      `[FX Media Controller] ConsoleAPI import failed: ${String(error)}\n`,
    );
    return proxyLogger();
  }
}

export const logger = createLogger();
