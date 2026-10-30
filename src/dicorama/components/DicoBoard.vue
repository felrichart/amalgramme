<script setup>
/*
 * One Dicorama level being played, filling its screen under the header: the
 * `side` slot beside the words' column (the score on top, its menu, the words),
 * the word being typed in the housing above the keyboard, and the celebration
 * over it all when the level is finished, then complete. `enter` slides the
 * column in from that side (-1: the left, 1: the right). Emits `progress` (see
 * progressOf) as it changes.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import ConfirmModal from '../../components/ui/ConfirmModal.vue';
import { isAdmin } from '../../composables/useAccount.js';
import { useDicorama } from '../useDicorama.js';
import DicoScore from './DicoScore.vue';
import DicoFinish from './DicoFinish.vue';
import DicoList from './DicoList.vue';
import DicoInput from './DicoInput.vue';
import DicoKeyboard from './DicoKeyboard.vue';

const props = defineProps({
  level: { type: Object, required: true },
  enter: { type: Number, default: 0 },
});
const emit = defineEmits(['progress']);
const router = useRouter();

const g = useDicorama(props.level);
watch(g.progress, (p) => emit('progress', p));

// Only while it lands: a card remade later (retyped) mustn't slide in again.
const arrival = computed(() => (g.phase.value === 'in' ? g.state.found[0] : null));
const nudge = computed(() => g.marked.value && { key: g.marked.value, n: g.wave.value });

const message = computed(() => {
  if (g.message.value === 'unknown') return { text: 'mot inconnu', tone: 'bad' };
  if (g.message.value === 'dup') return { text: 'déjà trouvé', tone: 'day' };
  const p = g.progress.value;
  if (p.complete && !g.phase.value)
    return p.rare < p.rareTotal
      ? { text: 'il ne reste que des mots rares', tone: 'day' }
      : { text: 'tout est trouvé, bravo !', tone: 'day' };
  return null;
});

const menu = ref(false);
const confirming = ref(false);
function askReset() {
  menu.value = false;
  confirming.value = true;
}
function reset() {
  g.reset();
  confirming.value = false;
}

/* Every word found over the goal, rare ones counting; then over every common
 * word, the rare ones found on top (19 /17+2). */
const bonus = computed(() => (g.stage.value === 2 ? g.progress.value.rare : 0));
const max = computed(() => {
  const p = g.progress.value;
  return g.stage.value === 1 ? p.goal : p.total - p.rare;
});

const LETTER = /^[a-zA-Zà-ÿÀ-ß]$/;
const GAME_KEYS = ['Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight'];
function onKeydown(e) {
  if (g.celebration.value) {
    if (e.key === 'Escape' || e.key === 'Enter') g.dismiss();
    return;
  }
  if (confirming.value || e.metaKey || e.ctrlKey || e.altKey) return;
  // Typing goes to the word, not to the button last tapped: drop its focus, or it
  // would show its keyboard focus ring.
  if (LETTER.test(e.key) || GAME_KEYS.includes(e.key)) document.activeElement?.blur?.();
  if (LETTER.test(e.key)) g.type(e.key);
  else if (e.key === 'Backspace') {
    e.preventDefault();
    g.backspace();
  } else if (e.key === 'Delete' || e.key === 'Escape') g.clear();
  else if (e.key === 'ArrowLeft') g.step(-1);
  else if (e.key === 'ArrowRight') g.step(1);
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="board-screen">
    <div class="body">
      <slot name="side" />
      <section
        class="dc-board words"
        :class="{ enter: enter }"
        :style="{ '--from': `${enter * 36}px` }"
      >
        <header class="head">
          <DicoScore :value="g.progress.value.score" :max="max" :bonus="bonus" />
          <div class="menu-wrap">
            <button
              class="dc-icon dots"
              type="button"
              aria-label="options du niveau"
              :aria-expanded="menu"
              @click="menu = !menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="5.5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="18.5" r="1.8" />
              </svg>
            </button>
            <div v-if="menu" class="menu" role="menu">
              <button type="button" role="menuitem" @click="askReset">Recommencer</button>
              <button
                v-if="isAdmin"
                type="button"
                role="menuitem"
                @click="router.push(`/dicorama/editer/${level.pattern}`)"
              >
                Éditer le niveau
              </button>
            </div>
          </div>
        </header>
        <DicoList
          :rows="g.list.value"
          :latest="g.latest.value"
          :arrival="arrival"
          :nudge="nudge"
          :common="g.stage.value === 2 ? max : null"
        />
      </section>
    </div>

    <section class="housing">
      <div class="tray">
        <DicoInput
          :slots="g.slots.value"
          :cursor="g.cursor.value"
          :phase="g.phase.value"
          :round="g.round.value"
          :shake="g.shake.value"
          :wave="g.wave.value"
          @pick="g.pick"
        />
        <p
          :key="message?.text"
          class="message"
          :class="message?.tone"
          role="status"
          aria-live="polite"
        >
          {{ message?.text }}
        </p>
      </div>
      <DicoKeyboard @key="g.type" @back="g.backspace" @clear="g.clear" />
    </section>
    <div v-if="menu" class="scrim" @click="menu = false" />

    <DicoFinish
      v-if="g.celebration.value"
      :kind="g.celebration.value"
      :progress="g.progress.value"
      @more="g.dismiss"
    />

    <ConfirmModal
      v-if="confirming"
      title="Recommencer ce niveau ? Les mots trouvés seront effacés."
      confirm-label="Recommencer"
      @cancel="confirming = false"
      @confirm="reset"
    />
  </div>
</template>

<style scoped>
.board-screen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 8px;
  padding: 0 12px;
  touch-action: pan-y;
}
.words {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.words.enter {
  /* No fill: a lasting transform would hold the fixed definition bubble. */
  animation: words-in 0.28s ease-out;
}
@keyframes words-in {
  from {
    opacity: 0;
    transform: translateX(var(--from));
  }
}
.head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 6px 8px 14px;
  border-bottom: 1px dashed var(--dc-board-edge);
}
.menu-wrap {
  position: relative;
  margin-left: auto;
}
.dots {
  width: 32px;
  height: 32px;
  color: var(--dc-faint);
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 40;
  min-width: 180px;
  padding: 6px;
  border-radius: 12px;
  background: var(--dc-board);
  box-shadow:
    inset 0 -3px 0 var(--dc-board-edge),
    0 10px 24px rgb(0 0 0 / 0.16);
  display: flex;
  flex-direction: column;
  animation: dico-appear 0.14s ease-out both;
}
.menu button {
  padding: 11px 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  text-align: left;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.menu button:active {
  background: var(--dc-tint);
}
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
}
.housing {
  margin-top: 12px;
  padding: 14px 10px max(26px, env(safe-area-inset-bottom));
  border-radius: 28px 28px 0 0;
  background: var(--dc-housing);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.3),
    0 -8px 24px rgb(0 0 0 / 0.08);
}
.tray {
  padding: 28px 14px 8px;
  border-radius: 16px;
  background: var(--dc-board);
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.35),
    inset 0 -3px 0 var(--dc-board-edge);
}
.message {
  height: 18px;
  margin-top: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  animation: dico-appear 0.18s ease-out both;
}
.message.bad {
  color: var(--dc-brick);
}
.message.day {
  color: var(--dc-day-ink);
}
/* Short screens (a phone browser with its bars): the list keeps the room. */
@media (max-height: 720px) {
  .housing {
    margin-top: 8px;
    padding: 10px 8px max(12px, env(safe-area-inset-bottom));
    gap: 8px;
  }
  .tray {
    padding: 22px 12px 4px;
  }
  .message {
    margin-top: 5px;
  }
}
</style>
