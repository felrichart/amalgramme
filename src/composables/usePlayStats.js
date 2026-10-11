import { ref, watch } from 'vue';
import { recordForDate } from '../data/levels.js';
import { recordPlay } from '../services/stats.js';
import { loadLevelsFor } from '../services/levels.js';

/*
 * Records this player's attempt now and their solve once `completed()` turns true,
 * and returns the finish-screen counts { attempts, successes }. The cached counts
 * are floored to 1 (reaching the finish proves one play) so they never read
 * "0 sur 0", then replaced by the server's once the solve is recorded.
 */
export function usePlayStats(date, completed) {
  const counts = (rec, floor = 0) => ({
    attempts: Math.max(rec.attempts ?? 0, floor),
    successes: Math.max(rec.successes ?? 0, floor),
  });
  const rec = recordForDate(date);
  const stats = ref(rec && counts(rec, 1));

  recordPlay(date, 'attempt');
  watch(
    completed,
    async (done) => {
      if (!done) return;
      await recordPlay(date, 'solve');
      await loadLevelsFor(date, 0);
      const fresh = recordForDate(date);
      if (fresh) stats.value = counts(fresh);
    },
    { immediate: true },
  );
  return stats;
}
