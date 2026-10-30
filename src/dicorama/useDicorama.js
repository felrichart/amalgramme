import { reactive, ref, computed, watch, onScopeDispose } from 'vue';
import { normalizeChar } from '../../shared/word-rules.js';
import { BLANK, judge, progressOf, listOf } from './game.js';
import { loadProgress, saveProgress } from './levels.js';

// Timings, in ms. A full word is answered at REPLY_AT, once its last card has
// settled: an unknown one shakes; a found one's letters dip left to right, WAVE_STAGGER apart, each for WAVE_MS (the typed
// ones turning over; see DicoInput), then slide out for OUT_MS; it's in the list after, while
// the fixed letters rise again for IN_MS. One already found only dips.
const REPLY_AT = 110;
export const WAVE_STAGGER = 45;
export const WAVE_MS = 320;
const OUT_MS = 320;
const IN_MS = 560;
// How long "mot inconnu" or "déjà trouvé" stays, unless one types on.
const MESSAGE_MS = 2400;
// The pause between a word settling in the list and the level's celebration.
const CELEBRATE_MS = 250;

/*
 * One Dicorama level being played: the blanks being typed (fixed letters stay
 * put), the found words and the score. The cursor is on the blank picked, else
 * the first empty one, else the last one, so a full word's last letter can be
 * retyped at once. A full word is checked as soon as its last letter is typed; a
 * rejected one stays on screen. The word that finishes the level, then the one
 * that completes it, then the one that finds the rare ones too, is celebrated
 * (`celebration`: 'goal' | 'all' | 'perfect'); the progress
 * shows its second stage, to completion, once the first celebration is over.
 * Auto-saves.
 */
export function useDicorama(level) {
  const saved = loadProgress(level.pattern);
  const state = reactive({
    found: saved.found.filter((k) => level.answers.has(k)),
    revealed: saved.revealed,
  });
  watch(state, () => saveProgress(level.pattern, { ...state }), { deep: true });

  const blanks = [...level.pattern].flatMap((ch, i) => (ch === BLANK ? [i] : []));
  // Per blank: `{ ch, gen }` (gen: which typing it was), or null.
  const cells = ref(blanks.map(() => null));
  let gen = 0;
  const picked = ref(null);
  // A full word: 'checking', then when found 'flip', 'out', and 'in' while the
  // next one starts.
  const phase = ref(null);
  // Counts the words found here, so each arrival animates.
  const round = ref(0);
  // 'unknown' | 'dup'
  const message = ref(null);
  const shake = ref(0);
  // Counts the words retyped, so each one's wave plays.
  const wave = ref(0);
  // The word just retyped, pointed at in the list until the next letter.
  const marked = ref(null);
  const celebration = ref(null);
  // Whether the goal was celebrated (or reached before this visit).
  const greeted = ref(false);

  const timers = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }
  function cancel(id) {
    clearTimeout(id);
    timers.delete(id);
  }
  onScopeDispose(() => timers.forEach(clearTimeout));
  let messageTimer = null;

  const playing = computed(() => !state.revealed);
  const busy = computed(() => ['checking', 'flip', 'out'].includes(phase.value));
  const cursor = computed(() => {
    if (busy.value || !playing.value) return null;
    if (picked.value != null) return picked.value;
    const empty = cells.value.findIndex((c) => !c);
    return empty >= 0 ? empty : blanks.length - 1;
  });

  const progress = computed(() => progressOf(level, state.found));
  greeted.value = progress.value.finished;
  const stage = computed(() => (greeted.value || state.revealed ? 2 : 1));
  const list = computed(() => listOf(level, state.found, state.revealed));
  const latest = computed(() => marked.value ?? state.found[0] ?? null);

  /* Every pattern position: a fixed letter, or blank `b` and what's typed there. */
  const slots = computed(() =>
    [...level.pattern].map((ch, i) => {
      const b = blanks.indexOf(i);
      return b < 0
        ? { ch, fixed: true }
        : { b, ch: cells.value[b]?.ch ?? null, gen: cells.value[b]?.gen };
    }),
  );

  function quiet() {
    message.value = null;
    marked.value = null;
  }

  function say(kind) {
    message.value = kind;
    cancel(messageTimer);
    messageTimer = later(() => (message.value = null), MESSAGE_MS);
  }

  function setCells(next) {
    cells.value = next;
    picked.value = null;
  }

  function type(raw) {
    const at = cursor.value;
    const ch = normalizeChar(raw).toUpperCase();
    if (at == null || !/^[A-Z]$/.test(ch)) return;
    quiet();
    const next = [...cells.value];
    next[at] = { ch, gen: ++gen };
    setCells(next);
    if (next.every(Boolean)) check();
  }

  /* Takes back the last letter of the word, wherever the cursor is. */
  function backspace() {
    if (busy.value || !playing.value) return;
    const last = cells.value.findLastIndex(Boolean);
    if (last < 0) return;
    quiet();
    setCells(cells.value.map((c, b) => (b === last ? null : c)));
  }

  function clear() {
    if (busy.value || !playing.value) return;
    quiet();
    setCells(blanks.map(() => null));
  }

  function pick(b) {
    if (busy.value || !playing.value) return;
    picked.value = b;
  }

  const step = (delta) =>
    pick(Math.min(blanks.length - 1, Math.max(0, (cursor.value ?? 0) + delta)));

  /* Judged at once, answered once the last card has settled (REPLY_AT). */
  function check() {
    const key = [...level.pattern]
      .map((ch, i) => (ch === BLANK ? cells.value[blanks.indexOf(i)].ch : ch))
      .join('');
    const kind = judge(level, key, state.found);
    picked.value = null;
    phase.value = 'checking';
    if (kind !== 'new') {
      return later(() => {
        phase.value = null;
        if (kind === 'dup') {
          wave.value++;
          marked.value = key;
        } else shake.value++;
        say(kind);
      }, REPLY_AT);
    }
    const outAt = REPLY_AT + (level.pattern.length - 1) * WAVE_STAGGER + WAVE_MS;
    later(() => (phase.value = 'flip'), REPLY_AT);
    later(() => (phase.value = 'out'), outAt);
    later(() => land(key), outAt + OUT_MS);
  }

  function land(key) {
    const before = progress.value;
    phase.value = 'in';
    state.found.unshift(key);
    round.value++;
    setCells(blanks.map(() => null));
    later(() => phase.value === 'in' && (phase.value = null), IN_MS);
    const now = progress.value;
    const reached = [
      ['perfect', 'perfect'],
      ['complete', 'all'],
      ['finished', 'goal'],
    ].find(([step]) => !before[step] && now[step])?.[1];
    if (reached) later(() => (celebration.value = reached), IN_MS + CELEBRATE_MS);
  }

  function dismiss() {
    celebration.value = null;
    greeted.value = progress.value.finished;
  }

  function reveal() {
    quiet();
    state.revealed = true;
    setCells(blanks.map(() => null));
  }

  /* Forgets the level's progress, to play it again. */
  function reset() {
    quiet();
    dismiss();
    state.found = [];
    state.revealed = false;
    setCells(blanks.map(() => null));
  }

  return {
    state,
    slots,
    cursor,
    phase,
    round,
    message,
    shake,
    wave,
    latest,
    marked,
    progress,
    stage,
    celebration,
    list,
    playing,
    type,
    backspace,
    clear,
    pick,
    step,
    reveal,
    reset,
    dismiss,
  };
}
