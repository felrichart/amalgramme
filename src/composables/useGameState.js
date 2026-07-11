import { reactive, computed, watch, ref } from 'vue';
import {
  puzzleForLevel,
  buildWords,
  buildSecret,
  buildPool,
  buildPoolByWord,
  shuffle,
  normalize,
} from '../game/puzzle.js';

const STORAGE_PREFIX = 'amalgramme:v3:level:';

/* Progress summary for a level, read by the level-select screen. */
export function levelProgress(idx) {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_PREFIX + idx));
    const found = s?.found ?? 0;
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

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key)) || null;
  } catch {
    return null;
  }
}
function save(key, data) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
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
export function useGameState(levelIndex) {
  const puzzle = puzzleForLevel(levelIndex);
  const words = buildWords(puzzle);
  const secret = buildSecret(puzzle);
  /* Total tiles per letter available across the 4 words. */
  const pool = buildPool(words);
  /* Same tiles, grouped by source word: one tray row per wheel. */
  const poolRows = buildPoolByWord(words);

  const saved = load(levelIndex);

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
  /* Where focus should land after `from`: next open word, else the still-unsolved secret, else nothing. */
  const focusAfter = (from) => {
    const w = nextUnsolved(from);
    if (w !== null) return w;
    return state.secretFound ? null : 'secret';
  };

  const state = reactive({
    active: saved?.completed ? null : firstUnsolved() ?? (saved?.secretFound ? null : 'secret'),
    secretFound: saved?.secretFound ?? false,
    completed: saved?.completed ?? false,
    startTime: saved?.startTime ?? null,
    endTime: saved?.endTime ?? null,
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
    if (typeof state.active !== 'number') return '';
    const byId = Object.fromEntries(words[state.active].letters.map((t) => [t.id, t.ch]));
    return path.map((id) => byId[id]).join('');
  });

  const allSolved = computed(() => solved.every(Boolean));

  const secretActive = computed(() => state.active === 'secret');

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

  const elapsedMs = computed(() =>
    state.startTime && state.endTime ? state.endTime - state.startTime : 0,
  );
  const foundCount = () => solved.filter(Boolean).length;

  /* --- actions --- */

  function ensureStarted() {
    if (state.startTime == null) state.startTime = Date.now();
  }

  /* Whole level is done only when every word and the secret are found. */
  function maybeFinish() {
    if (allSolved.value && state.secretFound && !state.completed) finish();
  }

  /* Promote a word to the big wheel; tapping a solved word is a no-op. */
  function activate(w) {
    if (state.completed || solved[w]) return;
    if (state.active !== w) {
      state.active = w;
      path.length = 0;
    }
  }

  /* Swap the dock to the secret keyboard; a no-op once the secret is found. */
  function activateSecret() {
    if (state.completed || state.secretFound) return;
    state.active = 'secret';
    path.length = 0;
  }

  function shuffleWheel() {
    if (state.active == null) return;
    shuffleSeeds[state.active] = (shuffleSeeds[state.active] * 2 + 7) % 100000 || 1;
  }

  /* Begin a fresh draw (finger pressed down). */
  function beginPath() {
    path.length = 0;
  }

  /* Extend the draw onto a tile; repeats and re-entry are ignored. */
  function appendTile(id) {
    if (typeof state.active !== 'number' || path.includes(id)) return;
    path.push(id);
    ensureStarted();
  }

  function clearPath() {
    path.length = 0;
  }

  /* Keyboard entry: consume the next unused tile matching the typed letter. */
  function typeLetter(raw) {
    if (typeof state.active !== 'number') return;
    const ch = normalize(raw);
    if (ch.length !== 1) return;
    const t = words[state.active].letters.find((t) => t.ch === ch && !path.includes(t.id));
    if (!t) return;
    appendTile(t.id);
    if (path.length === words[state.active].length) commit();
  }

  function backspace() {
    path.pop();
  }

  /*
   * Finger released (or word typed in full). Correct → lock the word and hop to
   * the next open one; full but wrong → shake; anything shorter → drop.
   */
  function commit() {
    const w = state.active;
    if (typeof w !== 'number') return;
    if (current.value === words[w].text) {
      solved[w] = true;
      path.length = 0;
      state.active = focusAfter(w);
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
    ensureStarted();
    if (secretInput.value.length < secret.length) return;
    if (secretInput.value === secret.text) {
      state.secretFound = true;
      maybeFinish();
      /* Level not done yet → drop back onto a word wheel instead of a locked keyboard. */
      if (!state.completed) state.active = firstUnsolved();
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
    state.active = null;
    state.endTime = Date.now();
  }

  watch(
    () => JSON.stringify({ solved, shuffleSeeds, s: state, sp: secretPicks }),
    () =>
      save(levelIndex, {
        solved: [...solved],
        shuffleSeeds: [...shuffleSeeds],
        found: foundCount(),
        secretFound: state.secretFound,
        secretPicks: [...secretPicks],
        completed: state.completed,
        startTime: state.startTime,
        endTime: state.endTime,
      }),
  );

  return {
    puzzle,
    words,
    secret,
    pool,
    poolRows,
    state,
    path,
    current,
    solved,
    allSolved,
    secretActive,
    trayRows,
    spentTiles,
    secretInput,
    shakeSignal,
    secretShake,
    elapsedMs,
    wheelTiles,
    activate,
    activateSecret,
    shuffleWheel,
    beginPath,
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
