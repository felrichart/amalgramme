import { reactive, computed, watch, ref } from 'vue';
import { buildWords, buildSecret, shuffle, normalize } from '../game/puzzle.js';
import { listDailies, puzzleForDate } from '../data/challenges.js';

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

/* Wipe one level's saved state (e.g. so the tutorial always starts fresh). */
export function resetLevel(date) {
  try {
    localStorage.removeItem(storageKey(date));
  } catch {
    /* storage unavailable: nothing to clear */
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
  });

  /* Tile ids drawn so far for the active word, in order. */
  const path = reactive([]);
  /*
   * Secret guess as the specific tray tiles spent, in typed order. Each pick is
   * { r, id, ch } — r is the tray row, id the tile's per-word id — so the exact
   * tile the player pressed greys out, even when several tiles share a letter.
   */
  const secretPicks = reactive(saved?.secretPicks ?? []);
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

  /* The guess so far, as a string, for matching and box display. */
  const secretInput = computed(() =>
    state.secretFound ? secret.text : secretPicks.map((p) => p.ch).join(''),
  );

  /* Guess is full but doesn't match: drives the crossed-out "wrong" styling. */
  const secretWrong = computed(
    () =>
      !state.secretFound &&
      secretInput.value.length === secret.length &&
      secretInput.value !== secret.text,
  );

  /* `${row}-${id}` of every spent tile, so the keyboard can grey the exact tiles. */
  const spentTiles = computed(() => new Set(secretPicks.map((p) => `${p.r}-${p.id}`)));

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
  }

  /* Promote a word to the big wheel; tapping a solved word is a no-op. */
  function activate(w) {
    if (state.completed || solved[w]) return;
    if (state.focus !== 'word' || state.wordIndex !== w) {
      state.focus = 'word';
      state.wordIndex = w;
      path.length = 0;
    }
  }

  /* Swap the dock to the secret keyboard; a no-op once the secret is found. */
  function activateSecret() {
    if (state.completed || state.secretFound) return;
    state.focus = 'secret';
    path.length = 0;
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

  /* Drop the current draw — on a fresh press (finger down) or an explicit clear. */
  function clearPath() {
    path.length = 0;
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

  function backspace() {
    path.pop();
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
      path.length = 0;
      /* Focus the next open word; when none remain, the unsolved secret, else nothing. */
      focusAfterWord(nextUnsolved(w));
      maybeFinish();
    } else if (path.length === words[w].length) {
      shakeSignal.value++;
      path.length = 0;
    } else {
      path.length = 0;
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

  /* Persist on any change to saved state. Deep-watches the reactive collections
   * directly rather than diffing a JSON snapshot. */
  watch(
    [solved, shuffleSeeds, secretPicks, () => state.secretFound, () => state.completed],
    () =>
      save(date, {
        solved: [...solved],
        shuffleSeeds: [...shuffleSeeds],
        secretFound: state.secretFound,
        secretPicks: [...secretPicks],
        completed: state.completed,
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
    allSolved,
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
  };
}
