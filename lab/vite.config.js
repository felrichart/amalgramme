import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Local-only playground for new game concepts (`npm run lab`). The production
// build starts from the root index.html and never reaches this folder.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [vue()],
  server: { port: 5174 },
});
