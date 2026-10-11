/*
 * Device-wide coach progress (not per level): whether the guided intro is done,
 * the step last reached (resumes if interrupted), and whether the one-off
 * secret-keyboard hint was shown.
 */
import { KEY_PREFIX, readJSON, writeJSON } from '../utils/storage.js';

const TUTORIAL_KEY = KEY_PREFIX + 'tutorial';

const DEFAULTS = { done: false, step: 0, keyboardSeen: false };

export function tutorialState() {
  return { ...DEFAULTS, ...readJSON(TUTORIAL_KEY, {}) };
}

/* Merge a patch into the stored progress. */
export function saveTutorialState(patch) {
  writeJSON(TUTORIAL_KEY, { ...tutorialState(), ...patch });
}
