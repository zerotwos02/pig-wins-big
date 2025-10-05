import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@':        path.resolve(__dirname, 'src'),
      '@core':    path.resolve(__dirname, 'src/core'),
      '@scenes':  path.resolve(__dirname, 'src/scenes'),
      '@ui':      path.resolve(__dirname, 'src/ui'),
      '@game':    path.resolve(__dirname, 'src/game'),
      '@net':     path.resolve(__dirname, 'src/net'),
      '@state':   path.resolve(__dirname, 'src/state'),
      '@styles':  path.resolve(__dirname, 'src/styles'),
      '@utils':   path.resolve(__dirname, 'src/utils'),
      // 👇 add this line
      '@gen':     path.resolve(__dirname, 'src/gen'),
    },
  },
});
