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
    return {
      found: s?.found ?? 0,
      secretFound: !!s?.secretFound,
      completed: !!s?.completed,
    };
  } catch {
    return { found: 0, secretFound: false, completed: false };
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

  const state = reactive({
    active: saved?.completed ? null : firstUnsolved(),
    secretFound: saved?.secretFound ?? false,
    completed: saved?.completed ?? false,
    startTime: saved?.startTime ?? null,
    endTime: saved?.endTime ?? null,
  });

  /* Tile ids drawn so far for the active word, in order. */
  const path = reactive([]);
  /* Letters typed toward the secret (normalised, ≤ secret length). */
  const secretInput = ref(saved?.secretFound ? secret.text : (saved?.secretInput ?? ''));
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

  /* Tiles left per letter: total pool minus what the current guess already spent. */
  const remaining = computed(() => {
    const left = { ...pool };
    for (const ch of secretInput.value) left[ch] = (left[ch] ?? 0) - 1;
    return left;
  });

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
      state.active = nextUnsolved(w);
      maybeFinish();
    } else if (path.length === words[w].length) {
      shakeSignal.value++;
      path.length = 0;
    } else {
      path.length = 0;
    }
  }

  /*
   * Spend one pooled tile of `raw` onto the secret guess. Ignored when the tile
   * is exhausted or the guess is already full; a full guess auto-checks — a match
   * locks the secret, a mismatch shakes and clears (restoring every tile).
   */
  function typeSecret(raw) {
    if (state.secretFound || secretInput.value.length >= secret.length) return;
    const ch = normalize(raw);
    if (!/^[a-z]$/.test(ch) || (remaining.value[ch] ?? 0) <= 0) return;
    secretInput.value += ch;
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
    secretInput.value = secretInput.value.slice(0, -1);
  }

  /* Wipe the whole secret guess, returning every tile to the pool. */
  function clearSecret() {
    if (state.secretFound) return;
    secretInput.value = '';
  }

  function finish() {
    state.completed = true;
    state.active = null;
    state.endTime = Date.now();
  }

  watch(
    () => JSON.stringify({ solved, shuffleSeeds, s: state, si: secretInput.value }),
    () =>
      save(levelIndex, {
        solved: [...solved],
        shuffleSeeds: [...shuffleSeeds],
        found: foundCount(),
        secretFound: state.secretFound,
        secretInput: secretInput.value,
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
    remaining,
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
