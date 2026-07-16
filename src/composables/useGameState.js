import { reactive, computed, watch, ref } from 'vue';
import { buildWords, buildSecret, shuffle, normalize } from '../game/puzzle.js';
import { listDailies, puzzleForDate } from '../data/challenges.js';
import { COMMUNITY_PREFIX, COMMUNITY_ID_LENGTH, trimId } from '../data/community.js';

const STORAGE_PREFIX = 'amalgramme:v3:level:';

/* Progress is keyed by the puzzle's date — stable across content changes, unlike
 * an array index, which shifts whenever the bank is reordered. */
function storageKey(date) {
  return STORAGE_PREFIX + date;
}

/* One-time migration of the old index-based saves to date keys. Assumes saves
 * predate the tutorial-at-index-0 shift, so index i maps to the i-th daily.
 * Idempotent: numeric keys are removed as converted, and an existing date key is
 * never overwritten. No-op when the bank is empty (cold client). Call once at
 * startup after the daily warm-up, so the first level load reads migrated state. */
export function migrateSaves() {
  try {
    const dailies = listDailies();
    for (let i = 0; i < dailies.length; i++) {
      const oldKey = STORAGE_PREFIX + i;
      const raw = localStorage.getItem(oldKey);
      if (raw === null) continue;
      const newKey = storageKey(dailies[i].date);
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, raw);
      localStorage.removeItem(oldKey);
    }
  } catch {
    /* storage unavailable: nothing to migrate */
  }
}

/* One-time re-key of community saves from the old full-UUID id to the short
 * (8-char) id now used by the backend, cache, routes, and keys. Idempotent:
 * already-short keys are skipped, and an existing short key is never overwritten
 * (mirrors migrateSaves). Daily and tutorial keys are left untouched. */
export function migrateCommunitySaves() {
  try {
    const prefix = STORAGE_PREFIX + COMMUNITY_PREFIX;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    for (const oldKey of keys) {
      const id = oldKey.slice(prefix.length);
      if (id.length <= COMMUNITY_ID_LENGTH) continue;
      const newKey = prefix + trimId(id);
      const raw = localStorage.getItem(oldKey);
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, raw);
      localStorage.removeItem(oldKey);
    }
  } catch {
    /* storage unavailable: nothing to migrate */
  }
}

/* Progress summary for a level, read by the level-select screens. */
export function levelProgress(date) {
  try {
    const s = load(date);
    const found = Array.isArray(s?.solved) ? s.solved.filter(Boolean).length : 0;
    const secretFound = !!s?.secretFound;
    const completed = !!s?.completed;
    return {
      found,
      secretFound,
      completed,
      /* Started but not finished: some word solved, secret found, or secret partly typed. */
      partial: !completed && (found > 0 || secretFound || (s?.secretPicks?.length ?? 0) > 0),
    };
  } catch {
    return { found: 0, secretFound: false, completed: false, partial: false };
  }
}

/* Every persisted level's date and whether it was completed, for the startup
 * backfill that reports pre-existing local saves to the stats backend (players
 * who progressed before stat reporting existed). Only started/finished levels. */
export function savedProgress() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(STORAGE_PREFIX)) continue;
      const date = k.slice(STORAGE_PREFIX.length);
      const prog = levelProgress(date);
      if (prog.completed || prog.partial) out.push({ date, completed: prog.completed });
    }
  } catch {
    /* storage unavailable: nothing to back up */
  }
  return out;
}

const TUTORIAL_KEY = 'amalgramme:v3:tutorial';

/* Coach walkthrough progress, tracked once per device rather than per level:
 * whether the player finished the guided intro, the step last reached (so it
 * resumes if interrupted mid-way), and whether the one-off secret-keyboard hint
 * has been shown. */
export function tutorialState() {
  try {
    return {
      done: false,
      step: 0,
      keyboardSeen: false,
      ...JSON.parse(localStorage.getItem(TUTORIAL_KEY)),
    };
  } catch {
    return { done: false, step: 0, keyboardSeen: false };
  }
}
/* Merge a patch into the stored tutorial progress. */
export function saveTutorialState(patch) {
  try {
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ ...tutorialState(), ...patch }));
  } catch {
    /* storage unavailable: the coach simply reappears next session */
  }
}

/* The tutorial used to be a standalone level (slug "tutoriel"); the coach is now
 * an inline first-play walkthrough. A player who finished that level knows the
 * rules, so carry them over as done and drop the orphaned save. */
export function migrateTutorial() {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + 'tutoriel');
    if (raw === null) return;
    if (JSON.parse(raw)?.completed) saveTutorialState({ done: true, keyboardSeen: true });
    localStorage.removeItem(STORAGE_PREFIX + 'tutoriel');
  } catch {
    /* storage unavailable: nothing to migrate */
  }
}

/* Wipe every level's saved state. */
export function resetAllProgress() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

function load(date) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(date))) || null;
  } catch {
    return null;
  }
}
function save(date, data) {
  try {
    localStorage.setItem(storageKey(date), JSON.stringify(data));
  } catch {
    /* storage full or unavailable: play without persistence */
  }
}

/*
 * Owns all mutable state for one level: a hidden `secret` and 4 words linked to
 * it. Each word is spelled by drawing a path through its letter wheel; the
 * secret is typed letter by letter into blank boxes. The level is complete once
 * every word is solved AND the secret is guessed.
 */
export function useGameState(date) {
  const puzzle = puzzleForDate(date);
  const words = buildWords(puzzle);
  const secret = buildSecret(puzzle);

  const saved = load(date);

  /* Total letter reveals the player may spend across the level (see useHelp). */
  const HELP_MAX = 3;

  const solved = reactive(saved?.solved ?? words.map(() => false));
  const shuffleSeeds = reactive(saved?.shuffleSeeds ?? words.map((_, i) => i + 1));

  const firstUnsolved = () => {
    const i = solved.findIndex((s) => !s);
    return i === -1 ? null : i;
  };
  /* Next open word after `from`, wrapping around; null when all are solved. */
  const nextUnsolved = (from) => {
    const n = solved.length;
    for (let s = 1; s <= n; s++) {
      const i = (from + s) % n;
      if (!solved[i]) return i;
    }
    return null;
  };
  /*
   * Which input the dock shows: 'word' (a corner wheel, `wordIndex`), 'secret'
   * (the guess keyboard), or 'none' (level done / nothing to type). Replaces the
   * old overloaded `active` (number | 'secret' | null).
   */
  const initialWord = saved?.completed ? null : firstUnsolved();
  const state = reactive({
    focus: saved?.completed
      ? 'none'
      : initialWord != null
        ? 'word'
        : saved?.secretFound
          ? 'none'
          : 'secret',
    wordIndex: initialWord,
    secretFound: saved?.secretFound ?? false,
    completed: saved?.completed ?? false,
    /* Letter reveals spent so far, 0..HELP_MAX (see useHelp). */
    helpUsed: saved?.helpUsed ?? 0,
    /* Count of leading secret letters revealed by help, once no word is left to reveal. */
    secretReveal: saved?.secretReveal ?? 0,
  });

  /* Per-word count of leading letters revealed by help (tile ids 0..n-1 of the answer). */
  const revealed = reactive(saved?.revealed ?? words.map(() => 0));

  /* Tile ids drawn so far for the active word, in order. */
  const path = reactive([]);
  /*
   * Secret guess as the specific tray tiles spent, in typed order. Each pick is
   * { r, id, ch } — r is the tray row, id the tile's per-word id — so the exact
   * tile the player pressed greys out, even when several tiles share a letter.
   *
   * Retrocompat: revealed secret letters used to be mere ghosts the player still
   * had to type, so an old save may hold picks for the now auto-filled prefix.
   * Drop those leading picks so the prefix doesn't double them (see secretInput).
   */
  const savedPicks = saved?.secretPicks ?? [];
  let prefixTyped = 0;
  while (
    prefixTyped < (saved?.secretReveal ?? 0) &&
    prefixTyped < savedPicks.length &&
    normalize(savedPicks[prefixTyped].ch) === secret.text[prefixTyped]
  )
    prefixTyped++;
  const secretPicks = reactive(savedPicks.slice(prefixTyped));
  /* Bumped whenever a full-but-wrong word is committed, so the wheel can shake. */
  const shakeSignal = ref(0);
  /* Bumped on a full-but-wrong secret guess, so the boxes can shake. */
  const secretShake = ref(0);

  /* --- derived --- */

  /* The active word's letters arranged around the wheel, per its shuffle seed. */
  function wheelTiles(w) {
    return shuffle(words[w].letters, shuffleSeeds[w]);
  }

  const current = computed(() => {
    if (state.focus !== 'word') return '';
    const byId = Object.fromEntries(words[state.wordIndex].letters.map((t) => [t.id, t.ch]));
    return path.map((id) => byId[id]).join('');
  });

  const allSolved = computed(() => solved.every(Boolean));

  /* Letter reveals the player has left. */
  const helpLeft = computed(() => HELP_MAX - state.helpUsed);
  /* Whether a reveal can still land on a word / the secret: reveals remain and
   * something is left to uncover there. Drive the two Aide buttons. */
  const canRevealWord = computed(
    () => helpLeft.value > 0 && words.some((w, i) => !solved[i] && revealed[i] < w.length),
  );
  const canRevealSecret = computed(
    () => helpLeft.value > 0 && !state.secretFound && state.secretReveal < secret.length,
  );

  const wordActive = computed(() => state.focus === 'word');
  const secretActive = computed(() => state.focus === 'secret');

  /*
   * Secret tray rows, one per wheel: letters follow that wheel's current order
   * while it's unsolved, then lock to the answer's own order once solved. Tiles
   * keep their id so a spent tile stays identified across re-renders.
   */
  const trayRows = computed(() =>
    words.map((w, i) =>
      (solved[i] ? w.letters : wheelTiles(i)).map((t) => ({ id: t.id, ch: t.ch })),
    ),
  );

  /* The guess so far: the help-revealed leading letters (locked prefix the player
   * can't edit) followed by the tiles they've typed. */
  const secretInput = computed(() =>
    state.secretFound
      ? secret.text
      : secret.text.slice(0, state.secretReveal) + secretPicks.map((p) => p.ch).join(''),
  );

  /* Guess is full but doesn't match: drives the crossed-out "wrong" styling. */
  const secretWrong = computed(
    () =>
      !state.secretFound &&
      secretInput.value.length === secret.length &&
      secretInput.value !== secret.text,
  );

  /* `${row}-${id}` of every spent tile, so the keyboard can grey the exact tiles:
   * the tiles the help-revealed secret prefix consumed (one free matching tile
   * per given leading letter, shown already pressed) plus the ones the player
   * typed. Reserving the prefix tiles also keeps physical typing off them. */
  const spentTiles = computed(() => {
    const set = new Set();
    const rows = trayRows.value;
    for (let i = 0; i < state.secretReveal; i++) {
      const ch = secret.text[i];
      for (let r = 0; r < rows.length; r++) {
        const t = rows[r].find((t) => t.ch === ch && !set.has(`${r}-${t.id}`));
        if (t) {
          set.add(`${r}-${t.id}`);
          break;
        }
      }
    }
    secretPicks.forEach((p) => set.add(`${p.r}-${p.id}`));
    return set;
  });

  /* First tray tile of `ch` not already spent — used when typing on a physical keyboard. */
  function firstFreeTile(ch) {
    const spent = spentTiles.value;
    const rows = trayRows.value;
    for (let r = 0; r < rows.length; r++) {
      for (const t of rows[r]) {
        if (t.ch === ch && !spent.has(`${r}-${t.id}`)) return { r, id: t.id, ch };
      }
    }
    return null;
  }

  /* --- actions --- */

  /* Whole level is done only when every word and the secret are found. */
  function maybeFinish() {
    if (allSolved.value && state.secretFound && !state.completed) finish();
  }

  /* Reset the draw to the active word's help-revealed leading letters, so a reveal
   * pre-traces the path and the player only extends it. Empty when the focus is
   * the secret / nothing. */
  function seedPath() {
    path.length = 0;
    if (state.focus === 'word' && state.wordIndex != null) {
      for (let i = 0; i < revealed[state.wordIndex]; i++) path.push(i);
    }
  }

  /* After a word resolves: focus the given next word, else the unsolved secret,
   * else nothing left to type. `next` is a word index or null (none open). */
  function focusAfterWord(next) {
    if (next != null) {
      state.focus = 'word';
      state.wordIndex = next;
    } else if (!state.secretFound) {
      state.focus = 'secret';
      state.wordIndex = null;
    } else {
      state.focus = 'none';
      state.wordIndex = null;
    }
    seedPath();
  }

  /* Promote a word to the big wheel; tapping a solved word is a no-op. */
  function activate(w) {
    if (state.completed || solved[w]) return;
    if (state.focus !== 'word' || state.wordIndex !== w) {
      state.focus = 'word';
      state.wordIndex = w;
      seedPath();
    }
  }

  /* Swap the dock to the secret keyboard; a no-op once the secret is found. */
  function activateSecret() {
    if (state.completed || state.secretFound) return;
    state.focus = 'secret';
    seedPath();
  }

  function shuffleWheel() {
    if (state.focus !== 'word') return;
    const w = state.wordIndex;
    shuffleSeeds[w] = (shuffleSeeds[w] * 2 + 7) % 100000 || 1;
  }

  /* Extend the draw onto a tile; repeats and re-entry are ignored. */
  function appendTile(id) {
    if (state.focus !== 'word' || path.includes(id)) return;
    path.push(id);
  }

  /* Drop the current draw back to the revealed prefix — on a fresh press (finger
   * down) or an explicit clear. */
  function clearPath() {
    seedPath();
  }

  /* Keyboard entry: consume the next unused tile matching the typed letter. */
  function typeLetter(raw) {
    if (state.focus !== 'word') return;
    const w = state.wordIndex;
    const ch = normalize(raw);
    if (ch.length !== 1) return;
    const t = words[w].letters.find((t) => t.ch === ch && !path.includes(t.id));
    if (!t) return;
    appendTile(t.id);
    if (path.length === words[w].length) commit();
  }

  /* Undo the last drawn tile, but never past the locked revealed prefix. */
  function backspace() {
    const floor = state.focus === 'word' && state.wordIndex != null ? revealed[state.wordIndex] : 0;
    if (path.length > floor) path.pop();
  }

  /*
   * Finger released (or word typed in full). Correct → lock the word and hop to
   * the next open one; full but wrong → shake; anything shorter → drop.
   */
  function commit() {
    if (state.focus !== 'word') return;
    const w = state.wordIndex;
    if (current.value === words[w].text) {
      solved[w] = true;
      /* Focus the next open word; when none remain, the unsolved secret, else nothing. */
      focusAfterWord(nextUnsolved(w));
      maybeFinish();
    } else if (path.length === words[w].length) {
      shakeSignal.value++;
      seedPath();
    } else {
      seedPath();
    }
  }

  /*
   * Spend one tray tile onto the secret guess. `arg` is either a tile press
   * ({ r, id, ch } from the on-screen keyboard) or a raw char (physical keyboard,
   * resolved to the first free matching tile). Ignored when the tile is already
   * spent or the guess is full; a full guess auto-checks — a match locks the
   * secret, a mismatch shakes (letters kept so the player can edit and retry).
   */
  function typeSecret(arg) {
    if (state.secretFound || secretInput.value.length >= secret.length) return;
    let pick;
    if (typeof arg === 'string') {
      const ch = normalize(arg);
      if (!/^[a-z]$/.test(ch)) return;
      pick = firstFreeTile(ch);
    } else if (arg && !spentTiles.value.has(`${arg.r}-${arg.id}`)) {
      pick = { r: arg.r, id: arg.id, ch: normalize(arg.ch) };
    }
    if (!pick) return;
    secretPicks.push(pick);
    if (secretInput.value.length < secret.length) return;
    if (secretInput.value === secret.text) {
      state.secretFound = true;
      maybeFinish();
      /* Level not done yet → drop back onto a word wheel instead of a locked keyboard. */
      if (!state.completed) focusAfterWord(firstUnsolved());
    } else {
      /* Wrong: shake but keep the letters so the player can edit and retry. */
      secretShake.value++;
    }
  }

  /* Take back the last typed letter, returning its tile to the pool. */
  function backspaceSecret() {
    if (state.secretFound) return;
    secretPicks.pop();
  }

  /* Wipe the whole secret guess, returning every tile to the pool. */
  function clearSecret() {
    if (state.secretFound) return;
    secretPicks.length = 0;
  }

  function finish() {
    state.completed = true;
    state.focus = 'none';
    state.wordIndex = null;
  }

  /*
   * Spend one reveal on `kind` ('word' | 'secret'). A word reveal uncovers the
   * next leading letter (first, then second, …) of a randomly chosen unsolved
   * word that still hides one; a secret reveal uncovers the next leading letter
   * of the énigme. A no-op when that kind can't be revealed (none left, or all
   * uncovered). The word pick is a deterministic pseudo-random spread over
   * helpUsed (no Math.random, per the seeded-shuffle convention), reproducible
   * across reloads.
   */
  function useHelp(kind) {
    if (kind === 'word') {
      if (!canRevealWord.value) return;
      const candidates = words
        .map((_, i) => i)
        .filter((i) => !solved[i] && revealed[i] < words[i].length);
      const s = (state.helpUsed * 9301 + 49297) % 233280;
      const pick = candidates[Math.floor((s / 233280) * candidates.length)];
      revealed[pick]++;
      /* If the revealed word is the docked one, extend its traced prefix now. */
      if (state.focus === 'word' && state.wordIndex === pick) seedPath();
    } else if (kind === 'secret') {
      if (!canRevealSecret.value) return;
      state.secretReveal++;
    } else {
      return;
    }
    state.helpUsed++;
  }

  /* Trace the focused word's revealed prefix from the first render. */
  seedPath();

  /* Persist on any change to saved state. Deep-watches the reactive collections
   * directly rather than diffing a JSON snapshot. */
  watch(
    [
      solved,
      shuffleSeeds,
      secretPicks,
      revealed,
      () => state.secretFound,
      () => state.completed,
      () => state.helpUsed,
      () => state.secretReveal,
    ],
    () =>
      save(date, {
        solved: [...solved],
        shuffleSeeds: [...shuffleSeeds],
        secretFound: state.secretFound,
        secretPicks: [...secretPicks],
        completed: state.completed,
        revealed: [...revealed],
        helpUsed: state.helpUsed,
        secretReveal: state.secretReveal,
      }),
    { deep: true },
  );

  return {
    puzzle,
    words,
    secret,
    state,
    path,
    current,
    solved,
    revealed,
    allSolved,
    helpLeft,
    canRevealWord,
    canRevealSecret,
    wordActive,
    secretActive,
    trayRows,
    spentTiles,
    secretInput,
    secretWrong,
    shakeSignal,
    secretShake,
    wheelTiles,
    activate,
    activateSecret,
    shuffleWheel,
    appendTile,
    clearPath,
    typeLetter,
    backspace,
    commit,
    typeSecret,
    backspaceSecret,
    clearSecret,
    useHelp,
  };
}
