import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      $lib: resolve('./src/lib'),
      $components: resolve('./src/lib/components'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
  },
});
