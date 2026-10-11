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
import { useEntry } from './useEntry.js';

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
 * Secret cells from a save. Older saves kept a typed sequence (`secretPicks`)
 * that started after the revealed prefix — and, before that, sometimes repeated
 * it — so lay those picks out from the first unlocked cell.
 */
function savedSecretCells(saved, secret, reveal) {
  if (saved?.secretEntry) return saved.secretEntry;
  const picks = saved?.secretPicks ?? [];
  let skip = 0;
  while (skip < Math.min(reveal, picks.length) && normalize(picks[skip].ch) === secret.text[skip])
    skip++;
  const cells = Array(secret.length).fill(null);
  picks.slice(skip, skip + secret.length - reveal).forEach((p, i) => (cells[reveal + i] = p));
  return cells;
}

/*
 * All mutable state for one level, auto-persisted. Words are typed from their
 * shuffled letters; the secret from tiles of the words' letters. The level is
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
    /* Open input: 'word' (piece `wordIndex`), 'secret', or 'none'. */
    focus: 'none',
    wordIndex: null,
    secretFound: saved?.secretFound ?? false,
    completed: saved?.completed ?? false,
    helpUsed: saved?.helpUsed ?? 0,
    /* Count of leading secret letters revealed by help. */
    secretReveal: saved?.secretReveal ?? 0,
  });

  /* The focused word's cells hold tile ids; the secret's hold tray picks
   * ({ r, id, ch }) so the exact pressed tile greys out. */
  const word = useEntry();
  const secretEntry = useEntry();
  secretEntry.reset(
    secret.length,
    state.secretReveal,
    savedSecretCells(saved, secret, state.secretReveal),
  );

  /* Bumped on a full-but-wrong word / secret, so the UI can shake. */
  const shakeSignal = ref(0);
  const secretShake = ref(0);

  /* --- derived --- */

  const wordActive = computed(() => state.focus === 'word');
  const secretActive = computed(() => state.focus === 'secret');
  const allSolved = computed(() => solved.every(Boolean));

  function shuffledTiles(w) {
    return shuffle(words[w].letters, shuffleSeeds[w]);
  }

  /* Focused word as one char per cell ('' where empty). */
  const wordChars = computed(() => {
    if (!wordActive.value) return [];
    const letters = words[state.wordIndex].letters;
    return word.cells.map((id) => (id == null ? '' : letters[id].ch));
  });
  const current = computed(() => wordChars.value.join(''));
  /* Tile ids already placed in the focused word. */
  const usedTiles = computed(() => word.cells.filter((id) => id != null));

  const helpLeft = computed(() => HELP_MAX - state.helpUsed);
  const revealableWords = computed(() =>
    words.map((_, i) => i).filter((i) => !solved[i] && revealed[i] < words[i].length),
  );
  const canRevealWord = computed(() => helpLeft.value > 0 && revealableWords.value.length > 0);
  const canRevealSecret = computed(
    () => helpLeft.value > 0 && !state.secretFound && state.secretReveal < secret.length,
  );

  /* One tray row per word: shuffled while unsolved, the answer's order once solved. */
  const trayRows = computed(() => words.map((w, i) => (solved[i] ? w.letters : shuffledTiles(i))));

  /* The secret as one char per cell: help-given prefix, then the placed picks. */
  const secretChars = computed(() =>
    state.secretFound
      ? [...secret.text]
      : secretEntry.cells.map((p, i) => (i < state.secretReveal ? secret.text[i] : (p?.ch ?? ''))),
  );
  const secretInput = computed(() => secretChars.value.join(''));

  const secretWrong = computed(
    () =>
      !state.secretFound && secretChars.value.every(Boolean) && secretInput.value !== secret.text,
  );

  /* Keys of every spent tile: one per revealed prefix letter (shown pressed, and
   * kept off physical typing), plus the placed picks. */
  const spentTiles = computed(() => {
    const set = new Set();
    for (const ch of secret.text.slice(0, state.secretReveal)) {
      const t = freeTile(trayRows.value, ch, set);
      if (t) set.add(tileKey(t.r, t.id));
    }
    secretEntry.cells.forEach((p) => p && set.add(tileKey(p.r, p.id)));
    return set;
  });

  /* --- actions --- */

  /* Empty the focused word down to its revealed prefix. */
  function resetWord() {
    if (!wordActive.value) return;
    const w = state.wordIndex;
    const prefix = words[w].letters.slice(0, revealed[w]).map((t) => t.id);
    word.reset(words[w].length, revealed[w], prefix);
  }

  function setFocus(focus, wordIndex = null) {
    state.focus = focus;
    state.wordIndex = wordIndex;
    resetWord();
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

  /* Open a word's input; a no-op on solved words. */
  function activate(w) {
    if (state.completed || solved[w]) return;
    if (!wordActive.value || state.wordIndex !== w) setFocus('word', w);
  }

  function activateSecret() {
    if (state.completed || state.secretFound) return;
    setFocus('secret');
  }

  function close() {
    setFocus('none');
  }

  function shuffleWord() {
    if (!wordActive.value) return;
    const w = state.wordIndex;
    shuffleSeeds[w] = (shuffleSeeds[w] * 2 + 7) % 100000 || 1;
  }

  /* Full word: correct → lock it and move on; wrong → shake (letters kept). */
  function checkWord() {
    const w = state.wordIndex;
    if (current.value === words[w].text) {
      solved[w] = true;
      focusNext(nextUnsolved(w + 1));
      maybeFinish();
      return;
    }
    shakeSignal.value++;
  }

  /* Place a tile at the cursor; already-placed tiles are ignored. */
  function appendTile(id) {
    if (!wordActive.value || usedTiles.value.includes(id)) return;
    if (word.place(id)) checkWord();
  }

  /* Keyboard entry: place the next unused tile matching the typed letter. */
  function typeLetter(raw) {
    if (!wordActive.value) return;
    const ch = normalize(raw);
    const t = words[state.wordIndex].letters.find(
      (t) => t.ch === ch && !usedTiles.value.includes(t.id),
    );
    if (t) appendTile(t.id);
  }

  /*
   * Spend one tray tile at the secret cursor: `arg` is a pressed tile ({ r, id, ch })
   * or a typed char (resolved to the first free matching tile). A full guess
   * auto-checks: a match locks the secret, a mismatch shakes (letters kept).
   */
  function typeSecret(arg) {
    if (!secretActive.value) return;
    let pick = null;
    if (typeof arg === 'string') {
      const ch = normalize(arg);
      if (/^[a-z]$/.test(ch)) pick = freeTile(trayRows.value, ch, spentTiles.value);
    } else if (arg && !spentTiles.value.has(tileKey(arg.r, arg.id))) {
      pick = { r: arg.r, id: arg.id, ch: normalize(arg.ch) };
    }
    if (!pick || !secretEntry.place(pick)) return;
    if (secretInput.value !== secret.text) {
      secretShake.value++;
      return;
    }
    state.secretFound = true;
    maybeFinish();
    // Level not done yet: drop back onto a word.
    if (!state.completed) focusNext(nextUnsolved());
  }

  /* The focused input (word or secret), for the shared edit actions below. */
  const entry = () => (wordActive.value ? word : secretActive.value ? secretEntry : null);

  function backspace() {
    entry()?.back();
  }
  function clearInput() {
    entry()?.clear();
  }
  function moveCursor(i) {
    entry()?.move(i);
  }
  function stepCursor(delta) {
    entry()?.step(delta);
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
      if (wordActive.value && state.wordIndex === pick) resetWord();
    } else if (kind === 'secret' && canRevealSecret.value) {
      state.secretReveal++;
      secretEntry.lock(state.secretReveal);
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
      secretEntry.cells,
      revealed,
      () => [state.secretFound, state.completed, state.helpUsed, state.secretReveal],
    ],
    () =>
      saveProgress(date, {
        solved: [...solved],
        shuffleSeeds: [...shuffleSeeds],
        secretFound: state.secretFound,
        secretEntry: [...secretEntry.cells],
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
    solved,
    revealed,
    allSolved,
    helpLeft,
    canRevealWord,
    canRevealSecret,
    wordActive,
    secretActive,
    wordChars,
    current,
    usedTiles,
    wordCursor: computed(() => word.state.cursor),
    trayRows,
    spentTiles,
    secretChars,
    secretInput,
    secretWrong,
    secretCursor: computed(() => secretEntry.state.cursor),
    shakeSignal,
    secretShake,
    shuffledTiles,
    activate,
    activateSecret,
    close,
    shuffleWord,
    appendTile,
    typeLetter,
    typeSecret,
    backspace,
    clearInput,
    moveCursor,
    stepCursor,
    useHelp,
  };
}
