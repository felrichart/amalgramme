/*
 * Startup upgrades of legacy saves. Each is idempotent and never overwrites a
 * current-format save. Run after the daily warm-up (index saves need the bank).
 */
import { readJSON, removeKey, keysWithPrefix, moveKey } from '../utils/storage.js';
import { LEVEL_PREFIX, levelKey } from './progress.js';
import { getDailies } from './dailies.js';
import { COMMUNITY_PREFIX, shortCommunityDate } from './community.js';
import { saveTutorialState } from './tutorial.js';

/* Index-based saves → date keys; index i maps to the i-th daily. */
export function migrateSaves() {
  getDailies().forEach((d, i) => moveKey(LEVEL_PREFIX + i, levelKey(d.date)));
}

/* Community saves keyed by a full UUID → the short id. */
export function migrateCommunitySaves() {
  for (const key of keysWithPrefix(LEVEL_PREFIX + COMMUNITY_PREFIX)) {
    const target = levelKey(shortCommunityDate(key.slice(LEVEL_PREFIX.length)));
    if (target !== key) moveKey(key, target);
  }
}

/* The tutorial used to be a standalone "tutoriel" level: finishing it means the
 * player knows the rules, so mark the coach done and drop the orphaned save. */
export function migrateTutorial() {
  const key = levelKey('tutoriel');
  const save = readJSON(key);
  if (save === null) return;
  if (save.completed) saveTutorialState({ done: true, keyboardSeen: true });
  removeKey(key);
}

export function runMigrations() {
  migrateSaves();
  migrateCommunitySaves();
  migrateTutorial();
}
