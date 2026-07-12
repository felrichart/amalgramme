import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router.js';
import { resolveToday } from './utils/today.js';
import {
  loadCommunityLevels,
  recordAttempt as recordCommunityAttempt,
  recordSolve as recordCommunitySolve,
} from './services/community.js';
import {
  loadDailies,
  recordAttempt as recordDailyAttempt,
  recordSolve as recordDailySolve,
} from './services/dailies.js';
import { migrateSaves, savedProgress } from './composables/useGameState.js';
import { isCommunityId, COMMUNITY_PREFIX } from './data/community.js';
import { TUTORIAL_DATE } from './data/challenges.js';

/* Report every locally-saved level to the stats backend once, so players who
 * progressed before stat reporting existed are counted. Both services dedupe
 * per device, so this is a no-op on levels already reported. */
function backfillStats() {
  for (const { date, completed } of savedProgress()) {
    if (date === TUTORIAL_DATE) continue;
    if (isCommunityId(date)) {
      const id = date.slice(COMMUNITY_PREFIX.length);
      recordCommunityAttempt(id);
      if (completed) recordCommunitySolve(id);
    } else {
      recordDailyAttempt(date);
      if (completed) recordDailySolve(date);
    }
  }
}

/* Resolve today's date (time API, device-clock fallback) before mounting, since
 * views read it lazily via todayDate() during render, and warm the daily +
 * community caches in the same pass so today's puzzle and a direct
 * /play/<date>|/play/com-<id> link resolve. None reject — the device clock and
 * the local caches back them up — so load always proceeds. Then bring any legacy
 * saves up to the current schema (needs the daily bank, hence after the warm-up). */
Promise.all([resolveToday(), loadDailies(0), loadCommunityLevels(0)]).then(() => {
  migrateSaves();
  backfillStats();
  createApp(App).use(router).mount('#app');
});
