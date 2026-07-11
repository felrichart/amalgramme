import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vite.dev/config/
// `base` is set from VITE_BASE in CI (to "/<repo>/" for GitHub Pages project
// sites); defaults to "/" for local dev. See .github/workflows/deploy.yml.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue()],
});
