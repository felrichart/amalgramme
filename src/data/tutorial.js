/*
 * Device-wide coach progress (not per level): whether the guided intro is done,
 * the step last reached (resumes if interrupted), and whether the one-off
 * secret-keyboard hint was shown.
 */
import { KEY_PREFIX, readJSON, writeJSON, readRaw, writeRaw } from '../utils/storage.js';

const TUTORIAL_KEY = KEY_PREFIX + 'tutorial';
const AIDE_HINT_KEY = 'amalgramme:aideHintSeen';

const DEFAULTS = { done: false, step: 0, keyboardSeen: false };

export function tutorialState() {
  return { ...DEFAULTS, ...readJSON(TUTORIAL_KEY, {}) };
}

/* Merge a patch into the stored progress. */
export function saveTutorialState(patch) {
  writeJSON(TUTORIAL_KEY, { ...tutorialState(), ...patch });
}

/* The one-off "Nouveau !" nudge towards the help button. */
export const aideHintSeen = () => readRaw(AIDE_HINT_KEY) === '1';
export const markAideHintSeen = () => writeRaw(AIDE_HINT_KEY, '1');
