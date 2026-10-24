<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../../src/components/ui/PageHeader.vue';
import ConfirmModal from '../../src/components/ui/ConfirmModal.vue';
import { useShake } from '../../src/composables/useShake.js';
import { LEVELS, levelByDate } from './levels.js';
import { maxScore, tierOf } from './game.js';
import { useLexilouhette } from './useLexilouhette.js';
import LexKeyboard from './LexKeyboard.vue';

const route = useRoute();
const router = useRouter();

const level = levelByDate(route.params.date);
const index = LEVELS.indexOf(level);
const next = LEVELS[index + 1];
const g = useLexilouhette(level);
const max = maxScore(level);
const shaking = useShake(() => g.shake.value);

/*
 * Scoring animation: a "+points" springs up from the word just found and flies
 * into the gauge; on arrival the gauge bumps and its number climbs one by one,
 * the fill following it. `shown` lags the real score until the climb catches up.
 */
const CLIMB_RATE = 0.35; // points per ms
const shown = ref(g.score.value);
const fill = computed(() => `${100 - (100 * shown.value) / max}%`);
const bump = ref(0);
const bumping = useShake(() => bump.value, 450);
let target = g.score.value;
let climb = 0;
let last = 0;
function tick(now) {
  const step = Math.max(1, Math.round((now - last) * CLIMB_RATE));
  shown.value = Math.min(target, shown.value + step);
  last = now;
  climb = shown.value < target ? requestAnimationFrame(tick) : 0;
}
function gain(points) {
  target += points;
  bump.value++;
  if (!climb) {
    last = performance.now();
    climb = requestAnimationFrame(tick);
  }
}
onUnmounted(() => cancelAnimationFrame(climb));

const gaugeEl = ref(null);
const floaters = ref([]);
let floaterId = 0;
const center = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
watch(
  () => g.feedback.value,
  async (f) => {
    if (f?.kind !== 'new') return;
    await nextTick();
    const word = listEl.value?.querySelector(`[data-key="${f.key}"]`);
    if (!word) return gain(f.points);
    // A word scrolled out of the list starts from the list's nearest edge.
    const list = listEl.value.getBoundingClientRect();
    const { x, y } = center(word);
    const from = { x, y: Math.min(list.bottom, Math.max(list.top, y)) };
    floaters.value.push({ id: ++floaterId, points: f.points, tier: tierOf(f.points), ...from });
  },
);
// Ref callback: runs once per new floater element.
const flying = new WeakSet();
function fly(el, f) {
  if (!el || flying.has(el)) return;
  flying.add(el);
  const to = center(gaugeEl.value);
  const at = (dx, dy, scale) =>
    `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
  const anim = el.animate(
    [
      { transform: at(0, 0, 0.4), opacity: 0 },
      { transform: at(0, 0, 1.25), opacity: 1, offset: 0.25 },
      { transform: at(0, 0, 1), opacity: 1, offset: 0.5 },
      { transform: at(to.x - f.x, to.y - f.y, 0.6), opacity: 0.5 },
    ],
    { duration: 950, easing: 'ease-in-out' },
  );
  anim.onfinish = () => {
    floaters.value = floaters.value.filter((x) => x.id !== f.id);
    gain(f.points);
  };
}

// Family colour per 100-point tier, cool to hot: periwinkle, sage, mustard, rose, red.
const TINTS = ['var(--violet)', 'var(--teal)', 'var(--gold)', 'var(--pink)', 'var(--danger)'];

const fresh = computed(() => (g.feedback.value?.kind === 'new' ? g.feedback.value.key : null));
const dup = computed(() => (g.feedback.value?.kind === 'dup' ? g.feedback.value.key : null));

const status = computed(() => {
  if (g.state.revealed) return { text: 'Solutions révélées' };
  if (g.exhausted.value) return { text: 'Plus aucun mot à trouver, bravo !', tone: 'good' };
  const f = g.feedback.value;
  if (f?.kind === 'new') {
    return { text: `${level.answers.get(f.key).display} +${f.points}`, tone: 'good' };
  }
  if (f?.kind === 'dup') return { text: 'Déjà trouvé', tone: 'bad' };
  if (f?.kind === 'unknown') return { text: 'Pas dans le dictionnaire', tone: 'bad' };
  if (!g.state.found.length) return { text: 'Complète les cases vides' };
  return { text: '' };
});

// Keep the highlighted word in view as the alphabetical list grows.
const listEl = ref(null);
watch(
  () => g.latest.value,
  async (key) => {
    if (!key) return;
    await nextTick();
    const chip = listEl.value?.querySelector(`[data-key="${key}"]`);
    chip?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
);

const confirming = ref(false);
function reveal() {
  confirming.value = false;
  g.reveal();
}

const LETTER = /^[a-zA-Zà-ÿÀ-ß]$/;
function onKeydown(e) {
  if (confirming.value || e.metaKey || e.ctrlKey || e.altKey) return;
  if (LETTER.test(e.key)) g.type(e.key);
  else if (e.key === 'Backspace') {
    e.preventDefault();
    g.backspace();
  } else if (e.key === 'ArrowLeft') g.step(-1);
  else if (e.key === 'ArrowRight') g.step(1);
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="page fit lex">
    <PageHeader :title="`Niveau ${index + 1}`" back="/lexilouhette" back-label="niveaux" />
    <div class="score-row">
      <div
        ref="gaugeEl"
        class="gauge"
        :class="{ bump: bumping }"
        role="meter"
        aria-label="score"
        :aria-valuenow="g.score.value"
        aria-valuemin="0"
        :aria-valuemax="max"
      >
        <div class="gauge-fill" :style="{ '--rest': fill }" />
        <span class="gauge-value">{{ shown }}</span>
      </div>
      <span
        v-for="f in floaters"
        :key="f.id"
        :ref="(el) => fly(el, f)"
        class="floater"
        :class="{ big: f.tier >= 3 }"
        :style="{ left: `${f.x}px`, top: `${f.y}px`, '--tint': TINTS[f.tier] }"
        aria-hidden="true"
        >+{{ f.points }}</span
      >
    </div>

    <section ref="listEl" class="found">
      <p v-if="!g.families.value.length" class="empty">Tes mots s'afficheront ici.</p>
      <ul class="families">
        <li
          v-for="f in g.families.value"
          :key="f.lemma"
          class="family"
          :class="{
            missed: f.words.every((w) => !w.found),
            fresh: f.words.some((w) => w.key === fresh),
            flash: dup && f.words.some((w) => w.key === dup),
          }"
          :style="{ '--tint': TINTS[f.tier], '--rows': f.words.length }"
        >
          <span
            v-for="w in f.words"
            :key="w.key"
            :data-key="w.key"
            class="word"
            :class="{ missed: !w.found, latest: w.key === g.latest.value }"
          >
            {{ w.display }}
            <span class="pts" :class="{ bonus: !w.lead }">{{
              w.lead ? w.points : `+${w.points}`
            }}</span>
          </span>
        </li>
      </ul>
    </section>

    <section class="play">
      <div
        class="silhouette"
        :class="{ shake: shaking, wrong: g.rejected.value }"
        :style="{ '--n': g.slots.value.length }"
      >
        <button
          v-for="(s, i) in g.slots.value"
          :key="i"
          class="cell"
          :class="{
            fixed: s.fixed,
            set: !s.fixed && s.ch,
            caret: !s.fixed && g.playing.value && s.b === g.cursor.value,
          }"
          type="button"
          tabindex="-1"
          :disabled="s.fixed || !g.playing.value"
          @click="g.moveTo(s.b)"
        >
          {{ s.ch }}
        </button>
      </div>

      <p class="status" :class="status.tone">{{ status.text }}</p>

      <template v-if="g.playing.value">
        <LexKeyboard @key="g.type" @back="g.backspace" />
        <button class="reveal" type="button" @click="confirming = true">Voir les solutions</button>
      </template>
      <div v-else class="end">
        <button
          v-if="next"
          class="cta press"
          type="button"
          @click="router.replace(`/lexilouhette/${next.date}`)"
        >
          Niveau suivant
        </button>
        <button class="cta ghost press" type="button" @click="router.push('/lexilouhette')">
          Tous les niveaux
        </button>
      </div>
    </section>

    <ConfirmModal
      v-if="confirming"
      title="Voir les solutions ? Le niveau s'arrête là."
      confirm-label="Voir"
      @cancel="confirming = false"
      @confirm="reveal"
    />
  </div>
</template>

<style scoped>
.score-row {
  display: flex;
  justify-content: center;
  padding: 0.1rem 1rem 0.5rem;
}
/* Score gauge: the full gradient, uncovered from the left as the score grows. */
.gauge {
  position: relative;
  width: min(80%, 21rem);
  height: 2.3rem;
  overflow: hidden;
  border: var(--outline-w) solid var(--outline);
  border-radius: 999px;
  background: var(--panel);
  box-shadow: var(--lift-sm);
}
.gauge.bump {
  animation: bump 0.45s ease;
}
.gauge-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--violet), var(--teal), var(--gold), var(--pink));
  clip-path: inset(0 var(--rest) 0 0);
}
.gauge-value {
  position: relative;
  display: grid;
  place-items: center;
  height: 100%;
  font-weight: 900;
  font-size: 1.2rem;
  color: var(--ink);
}
@keyframes bump {
  30% {
    transform: scale(1.08);
  }
}

/* Found words by family, alphabetical; scrolls once it outgrows the space. */
.found {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.6rem 1rem;
}
.empty {
  text-align: center;
  color: var(--muted);
  font-weight: 700;
  padding: 2rem 1rem;
}
/* Families fill a 3-column grid, each spanning one row per word; `dense` lets
   small ones fill the gaps beside tall ones. */
.families {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.9rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 2.3em;
  grid-auto-flow: dense;
  gap: 0.35em;
}
/* A family: a column in its colour, each word with the points it brought. The
   first found tops it with the lemma's points; the others add their bonus. */
.family {
  grid-row: span var(--rows);
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 0 0.15em;
  border: var(--outline-w) solid var(--outline);
  border-radius: 0.9em;
  background: color-mix(in srgb, var(--tint) 45%, var(--panel));
  box-shadow: var(--lift-sm);
}
.word {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3em;
  min-width: 0;
  padding: 0.05em 0.1em 0.05em 0.45em;
  border-radius: 999px;
  font-weight: 800;
  color: var(--ink);
  white-space: nowrap;
}
.pts {
  padding: 0.05em 0.4em;
  border-radius: 999px;
  font-size: 0.75em;
  font-weight: 900;
  color: var(--on-color);
  background: var(--tint);
}
.pts.bonus {
  color: var(--ink);
  background: color-mix(in srgb, var(--tint) 35%, var(--panel));
}
.family.fresh {
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.family.flash {
  animation: shake 0.4s ease;
}
/* The word just found or retyped: ringed until the next one. */
.word.latest {
  outline: 2px solid var(--ink);
}
/* Shown by the reveal: faded, they don't count. */
.word.missed {
  color: var(--muted);
}
.word.missed .pts {
  color: var(--muted);
  background: transparent;
  border: 1.5px dashed var(--muted);
}
.family.missed {
  --tint: var(--muted);
  border-style: dashed;
  box-shadow: none;
  background: transparent;
}

.play {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.8rem 0.6rem calc(1rem + env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
}

/* "+points": placed on the word found, flown into the gauge by fly(). */
.floater {
  position: fixed;
  z-index: 70;
  pointer-events: none;
  font-weight: 900;
  font-size: 1.5rem;
  color: color-mix(in srgb, var(--tint) 75%, var(--ink));
  transform: translate(-50%, -50%) scale(0.4);
  opacity: 0;
}
.floater.big {
  font-size: 1.9rem;
}

/* The silhouette: fixed letters as raised tiles, blanks as underlined slots. */
.silhouette {
  container-type: inline-size;
  display: flex;
  justify-content: center;
  gap: 0.35rem;
}
.silhouette.shake {
  animation: shake 0.4s ease;
}
.cell {
  flex: none;
  width: min(3rem, calc((100cqi - (var(--n) - 1) * 0.35rem) / var(--n)));
  aspect-ratio: 5 / 6;
  display: grid;
  place-items: center;
  padding: 0;
  font: inherit;
  font-weight: 900;
  font-size: min(1.9rem, calc(100cqi / var(--n) * 0.55));
  text-transform: uppercase;
  color: var(--ink);
  background: none;
  border-bottom: 3px solid color-mix(in srgb, var(--ink) 30%, transparent);
  border-radius: 0.4rem 0.4rem 0 0;
  cursor: pointer;
}
.cell:disabled {
  cursor: default;
}
.cell.fixed {
  border: var(--outline-w) solid var(--outline);
  border-radius: 0.6rem;
  color: var(--on-color);
  background: var(--accent);
  box-shadow: var(--lift-sm);
}
.cell.caret {
  border-bottom-color: var(--ink);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.cell.set {
  animation: pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wrong .cell:not(.fixed) {
  color: var(--danger);
}

.status {
  min-height: 1.4em;
  text-align: center;
  font-weight: 800;
  color: var(--muted);
}
.status.good {
  color: var(--ink);
}
.status.bad {
  color: var(--danger);
}

.reveal {
  align-self: center;
  padding: 0.2rem 0.6rem;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--muted);
  background: none;
  text-decoration: underline;
  cursor: pointer;
}
.end {
  display: flex;
  justify-content: center;
  gap: 0.7rem;
}
</style>
