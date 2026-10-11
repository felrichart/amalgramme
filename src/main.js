import { createApp } from 'vue';
import './style.css';
import './ui.css';
import App from './App.vue';
import router from './router.js';
import { resolveToday } from './utils/today.js';
import { loadDailies, loadCommunityLevels } from './services/levels.js';
import { recordPlay } from './services/stats.js';
import { runMigrations } from './data/migrations.js';
import { savedProgress } from './data/progress.js';
import { connected } from './composables/useAccount.js';
import { upgradeLegacyIdentity, refreshUser } from './services/account.js';
import { startSync, afterSignIn } from './services/sync.js';

/* Report every locally saved level once, so players who progressed before stats
 * existed are counted (no-op for levels already reported). */
function backfillStats() {
  for (const { date, completed } of savedProgress()) {
    recordPlay(date, 'attempt');
    if (completed) recordPlay(date, 'solve');
  }
}

/* Views read today's date and the cached banks synchronously, so resolve and warm
 * them before mounting. None reject (device clock and local caches back them up). */
Promise.all([resolveToday(), loadDailies(0), loadCommunityLevels(0)]).then(() => {
  runMigrations();
  backfillStats();
  startSync();
  createApp(App).use(router).mount('#app');
  // After mount: may ask the sync question, and must not delay the first paint.
  if (connected.value) refreshUser().then(afterSignIn);
  else upgradeLegacyIdentity();
});
