import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router.js';
import { resolveToday } from './utils/today.js';
import { loadCommunityLevels } from './services/community.js';
import { migrateSaves } from './composables/useGameState.js';

/* Resolve today's date (time API, device-clock fallback) before mounting, since
 * views read it lazily via todayDate() during render, and warm the community
 * cache in the same pass so a direct /play/com-<id> link resolves. Both never
 * reject — the device clock and the local cache back them up — so load always
 * proceeds. Then bring any legacy saves up to the current schema. */
Promise.all([resolveToday(), loadCommunityLevels(0)]).then(() => {
  migrateSaves();
  createApp(App).use(router).mount('#app');
});
