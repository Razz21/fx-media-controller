import * as esbuild from 'esbuild';

const logLevel = process.env.FXMC_LOG_LEVEL ?? 'debug';

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/fx-media-controller.js',
  format: 'iife',
  target: ['firefox115'],
  minifyWhitespace: true,
  define: {
    __FXMC_LOG_LEVEL__: JSON.stringify(logLevel),
  },
  plugins: [
    {
      name: 'build-notification',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length === 0) {
            console.log(
              `[${new Date().toLocaleTimeString()}] ✓ Build successful`,
            );
          }
        });
      },
    },
  ],
};

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
} else {
  await esbuild.build(buildOptions);
}
