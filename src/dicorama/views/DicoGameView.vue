<script setup>
/*
 * A Dicorama level: the date and score on top, the words on the cream board, the
 * word being typed in the housing above the keyboard. The day's colour tints it
 * all (today's for an undated level).
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import '../theme.js';
import ConfirmModal from '../../components/ui/ConfirmModal.vue';
import { isAdmin } from '../../composables/useAccount.js';
import { getToday } from '../../utils/today.js';
import { levelFor } from '../levels.js';
import { dayColor, dayLabel } from '../days.js';
import { useDicorama } from '../useDicorama.js';
import DicoScore from '../components/DicoScore.vue';
import DicoList from '../components/DicoList.vue';
import DicoInput from '../components/DicoInput.vue';
import DicoKeyboard from '../components/DicoKeyboard.vue';

// `source`: 'day' (route param: a date), 'official' or 'bank' (a pattern, admin).
const props = defineProps({ source: { type: String, required: true } });
const route = useRoute();
const router = useRouter();

const param = route.params.date ?? route.params.pattern;
const level = levelFor(props.source, param);
const g = useDicorama(level);

const color = dayColor(level.date ?? getToday());
const title = level.date ? dayLabel(level.date) : level.pattern.replaceAll('_', '·');
const back = props.source === 'bank' ? '/dicorama/banque' : '/dicorama';

// Only while it lands: a card remade later (retyped) mustn't slide in again.
const arrival = computed(() => (g.phase.value === 'in' ? g.state.found[0] : null));
const nudge = computed(() => g.marked.value && { key: g.marked.value, n: g.shake.value });

const message = computed(() => {
  if (g.message.value === 'unknown') return { text: 'mot inconnu', tone: 'bad' };
  if (g.message.value === 'dup') return { text: 'déjà trouvé', tone: 'day' };
  if (g.state.revealed) return { text: 'solutions révélées', tone: 'quiet' };
  if (g.done.value && !g.phase.value) return { text: 'tout est trouvé, bravo !', tone: 'day' };
  return null;
});

/* The menu, and the action it waits to confirm: 'reveal' or 'reset'. */
const menu = ref(false);
const confirming = ref(null);
const CONFIRMS = {
  reveal: { title: "Voir les solutions ? Le niveau s'arrête là.", label: 'Voir' },
  reset: {
    title: 'Recommencer ce niveau ? Tes mots trouvés seront effacés.',
    label: 'Recommencer',
  },
};
function ask(action) {
  menu.value = false;
  confirming.value = action;
}
function confirm() {
  g[confirming.value]();
  confirming.value = null;
}

const LETTER = /^[a-zA-Zà-ÿÀ-ß]$/;
const GAME_KEYS = ['Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight'];
function onKeydown(e) {
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
  <div class="dico game" :style="{ '--day': color }">
    <div class="screen">
      <header class="bar">
        <button class="dc-icon" type="button" aria-label="retour" @click="router.push(back)">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 class="date">{{ title }}</h1>
        <DicoScore :value="g.score.value.normal" :bonus="g.score.value.rare" />
        <div class="menu-wrap">
          <button
            class="dc-icon"
            type="button"
            aria-label="options"
            :aria-expanded="menu"
            @click="menu = !menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5.5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="18.5" r="1.8" />
            </svg>
          </button>
          <div v-if="menu" class="menu" role="menu">
            <button v-if="g.playing.value" type="button" role="menuitem" @click="ask('reveal')">
              Voir les solutions
            </button>
            <button type="button" role="menuitem" @click="ask('reset')">Recommencer</button>
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

      <DicoList :rows="g.list.value" :latest="g.latest.value" :arrival="arrival" :nudge="nudge" />

      <section class="housing">
        <div class="tray">
          <DicoInput
            :slots="g.slots.value"
            :cursor="g.cursor.value"
            :phase="g.phase.value"
            :round="g.round.value"
            :shake="g.shake.value"
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
        <DicoKeyboard
          :disabled="!g.playing.value"
          @key="g.type"
          @back="g.backspace"
          @clear="g.clear"
        />
      </section>
    </div>
    <div v-if="menu" class="scrim" @click="menu = false" />

    <ConfirmModal
      v-if="confirming"
      :title="CONFIRMS[confirming].title"
      :confirm-label="CONFIRMS[confirming].label"
      @cancel="confirming = null"
      @confirm="confirm"
    />
  </div>
</template>

<style scoped>
.game {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
.screen {
  height: 100%;
  max-width: 430px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}
.bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: max(10px, env(safe-area-inset-top)) 8px 8px 10px;
}
.date {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--dc-muted);
}
.menu-wrap {
  position: relative;
  margin-left: 4px;
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 40;
  min-width: 190px;
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
.message.quiet {
  color: var(--dc-faint);
}
</style>
