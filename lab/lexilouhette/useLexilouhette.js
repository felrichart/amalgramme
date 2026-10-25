import { reactive, ref, computed, watch, onScopeDispose } from 'vue';
import { normalizeChar } from '../../shared/word-rules.js';
import { BLANK, judge, scoreOf, earned, familiesOf } from './game.js';
import { loadProgress, saveProgress } from './levels.js';

// How long a found word's cheer stays, in ms.
const CHEER_MS = 2500;

/*
 * One Lexilouhette level being played: the blanks being typed (fixed letters stay
 * put), the found words and score. A guess is checked as soon as every blank is
 * set; a rejected one stays on screen to be corrected or retyped. Auto-saves.
 */
export function useLexilouhette(level) {
  const saved = loadProgress(level.pattern);
  const state = reactive({
    found: saved.found.filter((k) => level.answers.has(k)),
    revealed: saved.revealed,
  });
  watch(state, () => saveProgress(level.pattern, { ...state }), { deep: true });

  const blanks = [...level.pattern].flatMap((ch, i) => (ch === BLANK ? [i] : []));
  const cells = reactive(blanks.map(() => null));
  const cursor = ref(0);
  // The last guess's outcome: { kind: 'new' | 'dup' | 'unknown', key, points? }.
  const feedback = ref(null);
  const shake = ref(0);
  let cheerTimer = null;
  onScopeDispose(() => clearTimeout(cheerTimer));
  const rejected = computed(() => !!feedback.value && feedback.value.kind !== 'new' && isFull());

  const score = computed(() => scoreOf(level, state.found));
  const families = computed(() => familiesOf(level, state.found, state.revealed));
  const exhausted = computed(() => families.value.every((f) => f.found));
  const playing = computed(() => !exhausted.value && !state.revealed);
  // The word to highlight: the one just retyped, else the last one found.
  const latest = computed(() =>
    feedback.value?.kind === 'dup' ? feedback.value.key : (state.found[0] ?? null),
  );

  /* Every pattern position: a fixed letter, or blank `b` with what's typed there. */
  const slots = computed(() =>
    [...level.pattern].map((ch, i) => {
      const b = blanks.indexOf(i);
      return b < 0 ? { ch, fixed: true } : { ch: cells[b], b };
    }),
  );

  const isFull = () => cells.every((c) => c != null);

  function nextEmpty(from) {
    for (let k = 0; k < cells.length; k++) {
      const b = (from + k) % cells.length;
      if (cells[b] == null) return b;
    }
    return null;
  }

  function clear() {
    cells.fill(null);
    cursor.value = 0;
  }

  /* Forget the last outcome, except a found word's (it stays as the cheer, for
   * CHEER_MS). */
  function settle() {
    if (feedback.value?.kind !== 'new') feedback.value = null;
  }

  function submit() {
    const key = [...level.pattern].map((ch, i) => (ch === BLANK ? cells[blanks.indexOf(i)] : ch));
    const word = key.join('');
    const kind = judge(level, word, state.found);
    feedback.value = { kind, key: word };
    if (kind === 'new') {
      feedback.value.points = earned(level, state.found, word);
      state.found.unshift(word);
      clear();
      const cheer = feedback.value;
      clearTimeout(cheerTimer);
      cheerTimer = setTimeout(() => feedback.value === cheer && (feedback.value = null), CHEER_MS);
    } else shake.value++;
  }

  /* Typing straight after a rejected guess starts a fresh one. */
  function type(raw) {
    if (!playing.value) return;
    const ch = normalizeChar(raw).toUpperCase();
    if (!/^[A-Z]$/.test(ch)) return;
    if (rejected.value) clear();
    settle();
    cells[cursor.value] = ch;
    const next = nextEmpty(cursor.value + 1);
    if (next == null) submit();
    else cursor.value = next;
  }

  /* After a rejected guess the cursor still sits on the last letter typed. */
  function backspace() {
    if (!playing.value) return;
    const wasRejected = rejected.value;
    settle();
    if (!wasRejected && cells[cursor.value] == null && cursor.value > 0) cursor.value--;
    cells[cursor.value] = null;
  }

  /* Moving onto a rejected guess keeps it, so one letter can be retyped. */
  function moveTo(b) {
    if (!playing.value) return;
    settle();
    cursor.value = b;
  }

  const step = (delta) => moveTo(Math.min(cells.length - 1, Math.max(0, cursor.value + delta)));

  function reveal() {
    state.revealed = true;
    clear();
    feedback.value = null;
  }

  return {
    state,
    slots,
    cursor,
    feedback,
    shake,
    rejected,
    score,
    exhausted,
    playing,
    families,
    latest,
    type,
    backspace,
    moveTo,
    step,
    reveal,
  };
}
