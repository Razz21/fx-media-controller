import * as esbuild from 'esbuild';
import pkg from './package.json' with { type: 'json' };

const logLevel = process.env.FXMC_LOG_LEVEL ?? 'debug';

const version = process.env.FXMC_VERSION ?? `${pkg.version}-dev`;
const repoUrl = process.env.FXMC_REPO_URL ?? '';

const projectName = process.env.FXMC_PROJECT_NAME ?? 'FX Media Controller';

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
    __FXMC_VERSION__: JSON.stringify(version),
    __FXMC_REPO_URL__: JSON.stringify(repoUrl),
    __FXMC_PROJECT_NAME__: JSON.stringify(projectName),
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
