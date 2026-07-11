import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router.js';
import { resolveToday } from './utils/today.js';
import { migrateSaves } from './composables/useGameState.js';

/* Resolve today's date (time API, device-clock fallback) before mounting, since
 * views read it lazily via todayDate() during render. Then bring any legacy
 * saves up to the current schema before the first level loads. resolveToday
 * never rejects — the device clock backs the API up, so load always proceeds. */
resolveToday().then(() => {
  migrateSaves();
  createApp(App).use(router).mount('#app');
});
