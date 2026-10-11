import { reactive, computed, watch, ref } from 'vue';
import {
  buildWords,
  buildSecret,
  shuffle,
  seededIndex,
  normalize,
  tileKey,
} from '../game/puzzle.js';
import { puzzleForDate } from '../data/levels.js';
import { loadProgress, saveProgress } from '../data/progress.js';

/* Total letter reveals the player may spend across a level (see useHelp). */
export const HELP_MAX = 3;

/* First tile of `ch` across `rows` whose key isn't in `spent`, as a pick { r, id, ch }. */
function freeTile(rows, ch, spent) {
  for (let r = 0; r < rows.length; r++) {
    const t = rows[r].find((t) => t.ch === ch && !spent.has(tileKey(r, t.id)));
    if (t) return { r, id: t.id, ch };
  }
  return null;
}

/*
 * All mutable state for one level, auto-persisted. Words are drawn on their letter
 * wheels; the secret is typed from tiles of the words' letters. The level is
 * complete once every word AND the secret are found.
 */
export function useGameState(date) {
  const puzzle = puzzleForDate(date);
  const words = buildWords(puzzle);
  const secret = buildSecret(puzzle);
  const saved = loadProgress(date);

  const solved = reactive(saved?.solved ?? words.map(() => false));
  const shuffleSeeds = reactive(saved?.shuffleSeeds ?? words.map((_, i) => i + 1));
  /* Per-word count of leading letters revealed by help. */
  const revealed = reactive(saved?.revealed ?? words.map(() => 0));
  const state = reactive({
    /* Which input the dock shows: 'word' (wheel `wordIndex`), 'secret' (keyboard) or 'none'. */
    focus: 'none',
    wordIndex: null,
    secretFound: saved?.secretFound ?? false,
    completed: saved?.completed ?? false,
    helpUsed: saved?.helpUsed ?? 0,
    /* Count of leading secret letters revealed by help. */
    secretReveal: saved?.secretReveal ?? 0,
  });

  /* Tile ids drawn so far for the focused word, in order. */
  const path = reactive([]);

  /*
   * Secret guess as the tray tiles spent, in typed order ({ r, id, ch }), so the
   * exact pressed tile greys out. Old saves may hold picks for what is now the
   * auto-filled revealed prefix: drop those so the prefix isn't doubled.
   */
  const savedPicks = saved?.secretPicks ?? [];
  let prefixTyped = 0;
  while (
    prefixTyped < Math.min(state.secretReveal, savedPicks.length) &&
    normalize(savedPicks[prefixTyped].ch) === secret.text[prefixTyped]
  )
    prefixTyped++;
  const secretPicks = reactive(savedPicks.slice(prefixTyped));

  /* Bumped on a full-but-wrong word / secret, so the UI can shake. */
  const shakeSignal = ref(0);
  const secretShake = ref(0);

  /* --- derived --- */

  const wordActive = computed(() => state.focus === 'word');
  const secretActive = computed(() => state.focus === 'secret');
  const allSolved = computed(() => solved.every(Boolean));

  function wheelTiles(w) {
    return shuffle(words[w].letters, shuffleSeeds[w]);
  }

  const current = computed(() => {
    if (!wordActive.value) return '';
    const letters = words[state.wordIndex].letters;
    return path.map((id) => letters[id].ch).join('');
  });

  const helpLeft = computed(() => HELP_MAX - state.helpUsed);
  const revealableWords = computed(() =>
    words.map((_, i) => i).filter((i) => !solved[i] && revealed[i] < words[i].length),
  );
  const canRevealWord = computed(() => helpLeft.value > 0 && revealableWords.value.length > 0);
  const canRevealSecret = computed(
    () => helpLeft.value > 0 && !state.secretFound && state.secretReveal < secret.length,
  );

  /* One tray row per wheel: in the wheel's current order while unsolved, the
   * answer's order once solved. */
  const trayRows = computed(() => words.map((w, i) => (solved[i] ? w.letters : wheelTiles(i))));

  /* The guess: the help-revealed (locked) prefix, then the typed tiles. */
  const secretInput = computed(() =>
    state.secretFound
      ? secret.text
      : secret.text.slice(0, state.secretReveal) + secretPicks.map((p) => p.ch).join(''),
  );

  const secretWrong = computed(
    () =>
      !state.secretFound &&
      secretInput.value.length === secret.length &&
      secretInput.value !== secret.text,
  );

  /* Keys of every spent tile: one per revealed prefix letter (shown pressed, and
   * kept off physical typing), plus the typed picks. */
  const spentTiles = computed(() => {
    const set = new Set();
    for (const ch of secret.text.slice(0, state.secretReveal)) {
      const t = freeTile(trayRows.value, ch, set);
      if (t) set.add(tileKey(t.r, t.id));
    }
    secretPicks.forEach((p) => set.add(tileKey(p.r, p.id)));
    return set;
  });

  /* --- actions --- */

  /* Reset the draw to the focused word's revealed prefix, so the player only extends it. */
  function clearPath() {
    path.length = 0;
    if (wordActive.value) for (let i = 0; i < revealed[state.wordIndex]; i++) path.push(i);
  }

  function setFocus(focus, wordIndex = null) {
    state.focus = focus;
    state.wordIndex = wordIndex;
    clearPath();
  }

  /* Focus word `next` (an index, or null when none is open), else the unfound
   * secret, else nothing. */
  function focusNext(next) {
    if (next != null) setFocus('word', next);
    else setFocus(state.secretFound ? 'none' : 'secret');
  }

  /* First open word at or after `from`, wrapping around; null when all are solved. */
  function nextUnsolved(from = 0) {
    for (let s = 0; s < solved.length; s++) {
      const i = (from + s) % solved.length;
      if (!solved[i]) return i;
    }
    return null;
  }

  function maybeFinish() {
    if (allSolved.value && state.secretFound && !state.completed) {
      state.completed = true;
      setFocus('none');
    }
  }

  /* Dock a word's wheel; a no-op on solved words. */
  function activate(w) {
    if (state.completed || solved[w]) return;
    if (!wordActive.value || state.wordIndex !== w) setFocus('word', w);
  }

  function activateSecret() {
    if (state.completed || state.secretFound) return;
    setFocus('secret');
  }

  function shuffleWheel() {
    if (!wordActive.value) return;
    const w = state.wordIndex;
    shuffleSeeds[w] = (shuffleSeeds[w] * 2 + 7) % 100000 || 1;
  }

  /* Extend the draw onto a tile; repeats are ignored. */
  function appendTile(id) {
    if (wordActive.value && !path.includes(id)) path.push(id);
  }

  /* Keyboard entry: consume the next unused tile matching the typed letter. */
  function typeLetter(raw) {
    if (!wordActive.value) return;
    const word = words[state.wordIndex];
    const ch = normalize(raw);
    const t = word.letters.find((t) => t.ch === ch && !path.includes(t.id));
    if (!t) return;
    appendTile(t.id);
    if (path.length === word.length) commit();
  }

  /* Undo the last drawn tile, never past the revealed prefix. */
  function backspace() {
    const floor = wordActive.value ? revealed[state.wordIndex] : 0;
    if (path.length > floor) path.pop();
  }

  /* Finger released (or word typed in full): correct → lock it and move on;
   * full but wrong → shake; either way short of correct, restart the draw. */
  function commit() {
    if (!wordActive.value) return;
    const w = state.wordIndex;
    if (current.value === words[w].text) {
      solved[w] = true;
      focusNext(nextUnsolved(w + 1));
      maybeFinish();
      return;
    }
    if (path.length === words[w].length) shakeSignal.value++;
    clearPath();
  }

  /*
   * Spend one tray tile on the secret: `arg` is a pressed tile ({ r, id, ch }) or a
   * typed char (resolved to the first free matching tile). A full guess
   * auto-checks: a match locks the secret, a mismatch shakes (letters kept).
   */
  function typeSecret(arg) {
    if (state.secretFound || secretInput.value.length >= secret.length) return;
    let pick = null;
    if (typeof arg === 'string') {
      const ch = normalize(arg);
      if (/^[a-z]$/.test(ch)) pick = freeTile(trayRows.value, ch, spentTiles.value);
    } else if (arg && !spentTiles.value.has(tileKey(arg.r, arg.id))) {
      pick = { r: arg.r, id: arg.id, ch: normalize(arg.ch) };
    }
    if (!pick) return;
    secretPicks.push(pick);
    if (secretInput.value.length < secret.length) return;
    if (secretInput.value !== secret.text) {
      secretShake.value++;
      return;
    }
    state.secretFound = true;
    maybeFinish();
    // Level not done yet: drop back onto a word wheel.
    if (!state.completed) focusNext(nextUnsolved());
  }

  function backspaceSecret() {
    if (!state.secretFound) secretPicks.pop();
  }

  function clearSecret() {
    if (!state.secretFound) secretPicks.length = 0;
  }

  /*
   * Spend one reveal: 'word' uncovers the next leading letter of a pseudo-randomly
   * chosen unsolved word (seeded by helpUsed, so reproducible across reloads);
   * 'secret' the next leading letter of the secret.
   */
  function useHelp(kind) {
    if (kind === 'word' && canRevealWord.value) {
      const candidates = revealableWords.value;
      const pick = candidates[seededIndex(state.helpUsed, candidates.length)];
      revealed[pick]++;
      if (wordActive.value && state.wordIndex === pick) clearPath();
    } else if (kind === 'secret' && canRevealSecret.value) {
      state.secretReveal++;
    } else {
      return;
    }
    state.helpUsed++;
  }

  if (!state.completed) focusNext(nextUnsolved());

  watch(
    [
      solved,
      shuffleSeeds,
      secretPicks,
      revealed,
      () => [state.secretFound, state.completed, state.helpUsed, state.secretReveal],
    ],
    () =>
      saveProgress(date, {
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
