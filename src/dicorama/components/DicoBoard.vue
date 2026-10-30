<script setup>
/*
 * One Dicorama level being played, filling its screen under the header: a side
 * column (the score, the `side` slot, then the `foot` slot and the level's menu)
 * beside the words, which take all the height left, the word being typed in the
 * housing above the keyboard, and the celebration over it all when the level is
 * finished, then complete. Emits `progress` (see progressOf) as it changes.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { isAdmin } from '../../composables/useAccount.js';
import { scoreOf, REASONS } from '../game.js';
import { useDicorama } from '../useDicorama.js';
import DicoConfirm from './DicoConfirm.vue';
import DicoScore from './DicoScore.vue';
import DicoFinish from './DicoFinish.vue';
import DicoList from './DicoList.vue';
import DicoInput from './DicoInput.vue';
import DicoKeyboard from './DicoKeyboard.vue';

const props = defineProps({ level: { type: Object, required: true } });
const emit = defineEmits(['progress']);
const router = useRouter();

const g = useDicorama(props.level);
watch(g.progress, (p) => emit('progress', p));

// Only while it lands: a card remade later (retyped) mustn't slide in again.
const arrival = computed(() => (g.phase.value === 'in' ? g.state.found[0] : null));
const nudge = computed(() => g.marked.value && { key: g.marked.value, n: g.wave.value });

const message = computed(() => {
  if (g.message.value === 'unknown') return { text: 'mot inconnu', tone: 'bad' };
  if (REASONS[g.message.value]) return { text: REASONS[g.message.value], tone: 'bad' };
  if (g.message.value === 'dup') return { text: 'déjà trouvé', tone: 'day' };
  const { stars } = g.progress.value;
  if (g.phase.value || stars < 2) return null;
  return stars === 3
    ? { text: 'tout est trouvé, bravo !', tone: 'day' }
    : { text: 'il reste des mots rares à trouver', tone: 'day' };
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

const score = computed(() => scoreOf(g.progress.value, g.stage.value));

const LETTER = /^[a-zA-Zà-ÿÀ-ß]$/;
const GAME_KEYS = ['Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight'];
function onKeydown(e) {
  if (g.celebration.value) {
    if (e.key === 'Escape' || e.key === 'Enter') g.dismiss();
    return;
  }
  if (confirming.value) {
    if (e.key === 'Escape') confirming.value = false;
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
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
      <aside class="side">
        <DicoScore stacked v-bind="score" />
        <slot name="side" />
        <div class="side-foot">
          <slot name="foot" />
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
                <circle cx="5.5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="18.5" cy="12" r="1.8" />
              </svg>
            </button>
            <div v-if="menu" class="menu" role="menu">
              <button type="button" role="menuitem" @click="askReset">Remettre à zéro</button>
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
        </div>
      </aside>
      <DicoList
        class="dc-board words"
        :rows="g.list.value"
        :latest="g.latest.value"
        :arrival="arrival"
        :nudge="nudge"
      />
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

    <DicoConfirm
      v-if="confirming"
      title="Remettre le niveau à zéro ?"
      text="Tous les mots trouvés seront effacés."
      confirm-label="Remettre à zéro"
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
  gap: 10px;
  padding: 4px 12px 0;
}
.side {
  flex: none;
  width: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 0 4px;
}
.side-foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.words {
  flex: 1;
  min-width: 0;
  box-shadow: none;
}
.menu-wrap {
  position: relative;
}
.dots {
  width: 32px;
  height: 32px;
  color: var(--dc-faint);
}
.menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 4px);
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
