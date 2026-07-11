import { defineConfig } from 'vitest/config';

// Logic-only tests (no component rendering), so the lighter node env plus a
// localStorage polyfill is enough — see test/setup.js.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.js'],
  },
});
