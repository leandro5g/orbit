/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { rspack } from "@rspack/core";
import path from "node:path";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// O vídeo usa os componentes reais do popover (../src/renderer). A store deles (zustand, alimentada pelo
// Electron) é trocada por uma store controlada pelo frame do vídeo.
const RENDERER = path.resolve(process.cwd(), "../src/renderer/src");
const MOCK_STORE = path.resolve(process.cwd(), "src/orbit/store.tsx");

Config.overrideRspackConfig((config) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    new rspack.NormalModuleReplacementPlugin(/^\.\.?\/store$/, (resource: { context: string; request: string }) => {
      if (resource.context.startsWith(RENDERER)) resource.request = MOCK_STORE;
    }),
  ],
}));
