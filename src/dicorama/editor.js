/*
 * Edits an admin makes to a level before it's official. A draft is a level as
 * the Worker stores it: `{ pattern, words, rare, main, banned }` (see buildLevel in
 * game.js). Every edit returns a new draft.
 */
import { buildLevel, keyOf, spellingsOf, storedWord, wordPoints, RARE_POINTS } from './game.js';

/* A level as a draft, its rare and list families named: those it names, else
 * its defaults. */
export function draftFrom(level) {
  const { families } = buildLevel(level);
  const bases = (kind) => families.filter((f) => f[kind]).map((f) => f.base);
  return {
    pattern: level.pattern,
    words: structuredClone(level.words),
    rare: level.rare ?? bases('rare'),
    main: level.main ?? bases('main'),
    banned: level.banned ?? [],
  };
}

/* The draft's families, their words as spellings. */
const familiesOf = (draft) =>
  draft.words.map(([freq, base, ...words]) => ({
    freq,
    base,
    words: words.map((w) => spellingsOf(w, base, freq)),
  }));

const wordOf = (families, key) =>
  families.flatMap((f) => f.words).find((w) => keyOf(w[0].form) === key);

/* Leaves the spelling `form` of the word typed `key` out of the level. A banned
 * master gives way to the word's next spelling (see setMaster). */
export function ban(draft, key, form) {
  const banned = [...draft.banned, form];
  const word = wordOf(familiesOf(draft), key);
  const next = word.find((sp) => !banned.includes(sp.form));
  const moved = word[0].form === form && next ? setMaster(draft, key, next.form) : draft;
  return { ...moved, banned };
}

export const unban = (draft, form) => ({
  ...draft,
  banned: draft.banned.filter((f) => f !== form),
});

/* The banned spellings, with the word (typed `key`) they're of. */
export const bannedOf = (draft) =>
  familiesOf(draft).flatMap((f) =>
    f.words.flatMap((w) =>
      w
        .filter((sp) => draft.banned.includes(sp.form))
        .map((sp) => ({ ...sp, key: keyOf(sp.form) })),
    ),
  );

/* Puts the family of `base` in the list ('main'), among the other common ones
 * ('extra') or the rare ones ('rare'). */
export function setKind(draft, base, kind) {
  const without = (bases) => bases.filter((b) => b !== base);
  return {
    ...draft,
    rare: kind === 'rare' ? [...without(draft.rare), base] : without(draft.rare),
    main: kind === 'main' ? [...without(draft.main), base] : without(draft.main),
  };
}

/*
 * Makes `form` the master spelling of the word typed `key`. The word follows its
 * new master's base: into that base's family, made when the level has none (rare
 * from RARE_POINTS, like the bank's); a family left empty goes.
 */
export function setMaster(draft, key, form) {
  const families = familiesOf(draft);
  const word = wordOf(families, key);
  const from = families.find((f) => f.words.includes(word));
  const master = word.find((sp) => sp.form === form);
  const spellings = [master, ...word.filter((sp) => sp !== master)];
  let rare = draft.rare;

  if (master.base === from.base) from.words[from.words.indexOf(word)] = spellings;
  else {
    from.words = from.words.filter((w) => w !== word);
    let to = families.find((f) => f.base === master.base);
    if (!to) {
      to = { freq: master.freq, base: master.base, words: [] };
      families.push(to);
      if (wordPoints(master.freq) >= RARE_POINTS) rare = [...rare, master.base];
    }
    // The base's own word first, as the generator has it.
    if (master.form === to.base) to.words.unshift(spellings);
    else to.words.push(spellings);
  }

  const kept = families.filter((f) => f.words.length);
  const isKept = (b) => kept.some((f) => f.base === b);
  return {
    ...draft,
    words: kept.map((f) => [f.freq, f.base, ...f.words.map((w) => storedWord(w, f.base))]),
    rare: rare.filter(isKept),
    main: draft.main.filter(isKept),
  };
}
