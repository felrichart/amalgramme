/*
 * Edits an admin makes to a level before it's official. A draft is a level as
 * the Worker stores it: `{ pattern, words, clues, banned, reasons, conjugated }`
 * (see buildLevel in game.js). Every edit returns a new draft.
 */
import { buildLevel, keyOf, defaultClues, CLUES_MIN, CLUES_MAX } from './game.js';

/* A level as a draft: its riddles, else the default ones, their clues to write. */
export function draftFrom(level) {
  return {
    pattern: level.pattern,
    words: structuredClone(level.words),
    clues: level.clues ? { ...level.clues } : defaultClues(level),
    banned: level.banned ?? [],
    reasons: level.reasons ?? {},
    conjugated: level.conjugated ?? [],
  };
}

/* Makes the word typed `key` a riddle (its clue to write), or a bonus word. */
export function setRiddle(draft, key, riddle) {
  const { [key]: clue, ...others } = draft.clues;
  return { ...draft, clues: riddle ? { ...others, [key]: clue ?? '' } : others };
}

export const setClue = (draft, key, clue) => ({ ...draft, clues: { ...draft.clues, [key]: clue } });

/* Whether the draft can be played: CLUES_MIN to CLUES_MAX riddles, each clued. */
export function validOf(draft) {
  const level = buildLevel(draft);
  const clues = level.riddles.map((k) => level.answers.get(k).clue);
  return clues.length >= CLUES_MIN && clues.length <= CLUES_MAX && clues.every((c) => c.trim());
}

/* Makes `form` the master spelling of the word typed `key`. */
export function setMaster(draft, key, form) {
  const at = draft.words.findIndex((sp) => keyOf(sp[0]) === key);
  const moved = draft.words.find((sp) => sp[0] === form);
  const words = draft.words.filter((sp) => sp !== moved);
  words.splice(at, 0, moved);
  return { ...draft, words };
}

/* Leaves the spelling `form` out of the level, for `reason` (see REASONS in
 * game.js). A banned master gives way to its word's next spelling. */
export function ban(draft, form, reason = 'invalid') {
  return {
    ...draft,
    banned: [...draft.banned, form],
    reasons: { ...draft.reasons, [form]: reason },
  };
}

export function unban(draft, form) {
  const { [form]: _, ...reasons } = draft.reasons;
  return { ...draft, banned: draft.banned.filter((f) => f !== form), reasons };
}

/* The banned spellings, with the word (typed `key`) they're of and their reason. */
export const bannedOf = (draft) =>
  draft.words
    .filter(([form]) => draft.banned.includes(form))
    .map(([form]) => ({ form, key: keyOf(form), reason: draft.reasons[form] ?? 'invalid' }));
