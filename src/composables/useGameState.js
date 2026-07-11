import { reactive, computed, watch, ref } from 'vue';
import { puzzleForLevel, buildWords, buildSecret, shuffle, normalize } from '../game/puzzle.js';

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
  const secretInput = ref(state.secretFound ? secret.text : '');
  /* Bumped whenever a full-but-wrong word is committed, so the wheel can shake. */
  const shakeSignal = ref(0);

  /* --- derived --- */

  /* The active word's letters arranged around the wheel, per its shuffle seed. */
  function wheelTiles(w) {
    return shuffle(words[w].letters, shuffleSeeds[w]);
  }

  const current = computed(() => {
    if (state.active == null) return '';
    const byId = Object.fromEntries(words[state.active].letters.map((t) => [t.id, t.ch]));
    return path.map((id) => byId[id]).join('');
  });

  const allSolved = computed(() => solved.every(Boolean));

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
    if (state.active == null || path.includes(id)) return;
    path.push(id);
    ensureStarted();
  }

  function clearPath() {
    path.length = 0;
  }

  /* Keyboard entry: consume the next unused tile matching the typed letter. */
  function typeLetter(raw) {
    if (state.active == null) return;
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
    if (w == null) return;
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
   * Update the secret guess from the native input. Diacritics are folded and
   * non-letters dropped so a typed "é"/"ç" matches the accent-free answer; once
   * the full secret matches it locks and can complete the level.
   */
  function setSecretInput(raw) {
    if (state.secretFound) return;
    const cleaned = Array.from(raw)
      .map((ch) => normalize(ch))
      .filter((ch) => /^[a-z]$/.test(ch))
      .join('')
      .slice(0, secret.length);
    secretInput.value = cleaned;
    if (cleaned) ensureStarted();
    if (cleaned === secret.text) {
      state.secretFound = true;
      maybeFinish();
    }
  }

  function finish() {
    state.completed = true;
    state.active = null;
    state.endTime = Date.now();
  }

  watch(
    () => JSON.stringify({ solved, shuffleSeeds, s: state }),
    () =>
      save(levelIndex, {
        solved: [...solved],
        shuffleSeeds: [...shuffleSeeds],
        found: foundCount(),
        secretFound: state.secretFound,
        completed: state.completed,
        startTime: state.startTime,
        endTime: state.endTime,
      }),
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
    secretInput,
    shakeSignal,
    elapsedMs,
    wheelTiles,
    activate,
    shuffleWheel,
    beginPath,
    appendTile,
    clearPath,
    typeLetter,
    backspace,
    commit,
    setSecretInput,
  };
}
