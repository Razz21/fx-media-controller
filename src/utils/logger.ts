const proxyLogger = () =>
  new Proxy({} as ConsoleAPI, {
    get() {
      return () => {};
    },
  });

function createLogger(): ConsoleAPI {
  try {
    const { ConsoleAPI } = ChromeUtils.importESModule<{
      ConsoleAPI?: ConsoleAPIConstructor;
    }>('resource://gre/modules/Console.sys.mjs');

    if (!ConsoleAPI) {
      dump(`[MediaKit] ConsoleAPI is not available\n`);
      return proxyLogger();
    }

    return new ConsoleAPI({
      prefix: 'MediaKit',
      maxLogLevel: __MEDIAKIT_LOG_LEVEL__,
    });
  } catch (error) {
    dump(`[MediaKit] ConsoleAPI import failed: ${String(error)}\n`);
    return proxyLogger();
  }
}

export const logger = createLogger();
