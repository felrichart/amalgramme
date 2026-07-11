<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameState } from '../composables/useGameState.js';
import { PUZZLES_NEW as PUZZLES } from '../data/challenges.js';
import LetterWheel from '../components/LetterWheel.vue';
import SuccessScreen from '../components/SuccessScreen.vue';

const route = useRoute();
const router = useRouter();

const levelIndex = Number(route.params.level);
if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= PUZZLES.length) {
  router.replace('/');
}

const g = useGameState(levelIndex);

/* Slots above the wheel that fill in as the path is drawn. */
const slots = computed(() => {
  if (g.state.active == null) return [];
  const len = g.words[g.state.active].length;
  const cur = g.current.value;
  return Array.from({ length: len }, (_, i) => cur[i] || '');
});

/* Secret boxes: one per letter, filled as the player types the guess. */
const secretSlots = computed(() =>
  Array.from({ length: g.secret.length }, (_, i) => g.secretInput.value[i] || ''),
);

/* Physical keyboard mirrors the drawing: type to fill, backspace/escape to undo. */
function onKeydown(e) {
  /* Typing into the secret field must not drive the wheel. */
  if (e.target instanceof HTMLInputElement) return;
  if (g.state.completed || g.state.active == null) return;
  if (e.key === 'Backspace') {
    e.preventDefault();
    g.backspace();
  } else if (e.key === 'Escape') {
    g.clearPath();
  } else if (e.key === 'Enter') {
    g.commit();
  } else if (e.key === ' ') {
    e.preventDefault();
    g.shuffleWheel();
  } else if (/^[a-zA-Zà-ÿÀ-ß]$/.test(e.key)) {
    g.typeLetter(e.key);
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="game">
    <header class="top">
      <button class="icon-btn" type="button" @click="router.push('/')" aria-label="niveaux">
        ←
      </button>
      <label class="secret glass" :class="{ found: g.state.secretFound }">
        <span class="secret-label">
          {{ g.state.secretFound ? '🔑 secret' : '🔒 secret' }}
        </span>
        <span class="secret-boxes">
          <input
            class="secret-field"
            type="text"
            :value="g.secretInput.value"
            :maxlength="g.secret.length"
            :disabled="g.state.secretFound"
            inputmode="text"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            aria-label="devine le secret"
            @input="g.setSecretInput($event.target.value)"
          />
          <span v-for="(ch, i) in secretSlots" :key="i" class="sbox" :class="{ set: ch }">{{
            ch
          }}</span>
        </span>
      </label>
      <div class="spacer" />
    </header>

    <main class="grid">
      <template v-for="(w, i) in g.words" :key="i">
        <div v-if="g.solved[i]" class="slot done glass">
          <span class="answer">{{ w.text }}</span>
        </div>
        <button
          v-else
          class="slot glass"
          :class="{ active: g.state.active === i }"
          type="button"
          @click="g.activate(i)"
        >
          <LetterWheel :tiles="g.wheelTiles(i)" />
        </button>
      </template>
    </main>

    <div v-if="g.state.active != null && !g.state.completed" class="dock">
      <div class="track" :class="{ full: g.current.value.length === slots.length }">
        <span v-for="(ch, i) in slots" :key="i" class="tick" :class="{ set: ch }">{{ ch }}</span>
      </div>

      <div class="stage">
        <LetterWheel
          interactive
          :tiles="g.wheelTiles(g.state.active)"
          :path="g.path"
          :shake="g.shakeSignal.value"
          @begin="g.beginPath"
          @enter="g.appendTile"
          @backtrack="g.backspace"
          @end="g.commit"
          @shuffle="g.shuffleWheel"
        />
      </div>
    </div>

    <SuccessScreen
      v-if="g.state.completed"
      :elapsed-ms="g.elapsedMs.value"
      :secret="g.secret.text"
      @levels="router.push('/')"
    />
  </div>
</template>

<style scoped>
.game {
  min-height: 100dvh;
  max-height: 100dvh;
  display: flex;
  flex-direction: column;
  max-width: 560px;
  margin: 0 auto;
}

.top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem 0.5rem;
}
.icon-btn {
  width: 2.6rem;
  height: 2.6rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 1.3rem;
  border-radius: 0.9rem;
  color: var(--ink);
  cursor: pointer;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--glass-brd);
  backdrop-filter: blur(12px);
  transition:
    transform 0.12s ease,
    background 0.2s ease;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.8);
}
.icon-btn:active {
  transform: scale(0.92);
}
.icon-btn:focus-visible {
  outline: 2px solid var(--sky-ink);
  outline-offset: 2px;
}
.spacer {
  width: 2.6rem;
  flex: none;
}

/* Secret: a hidden native input overlays the letter boxes so the OS keyboard
   opens on tap while the guess renders box by box. */
.secret {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 1rem;
  cursor: text;
  transition:
    box-shadow 0.25s ease,
    background 0.25s ease;
}
.secret-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--muted);
}
.secret-boxes {
  position: relative;
  display: flex;
  gap: 0.28rem;
}
.secret-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  color: transparent;
  caret-color: transparent;
  font: inherit;
  text-align: center;
  outline: none;
  cursor: text;
}
.sbox {
  width: 1.5rem;
  height: 1.9rem;
  display: grid;
  place-items: center;
  border-radius: 0.45rem;
  font-weight: 800;
  font-size: 1rem;
  text-transform: uppercase;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.7);
}
.sbox.set {
  background: linear-gradient(160deg, #fff, color-mix(in srgb, var(--sky) 45%, #fff));
}
/* Found: the whole strip turns calm-green and locks. */
.secret.found {
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--lemon) 70%, #fff),
    color-mix(in srgb, var(--sky) 40%, #fff)
  );
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--sky-ink) 35%, transparent);
}
.secret.found .secret-label {
  color: var(--sky-ink);
}
.secret.found .sbox {
  background: linear-gradient(160deg, #fff, color-mix(in srgb, var(--sky) 55%, #fff));
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: center;
  gap: 0.7rem;
  padding: 0.6rem 1rem 0.4rem;
}
.slot {
  border-radius: 1.2rem;
  padding: 0.7rem;
  min-height: 5.2rem;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition:
    transform 0.14s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}
.slot:active {
  transform: scale(0.97);
}
.slot:focus-visible {
  outline: 2px solid var(--sky-ink);
  outline-offset: 2px;
}
.slot.active {
  border-color: color-mix(in srgb, var(--sky-ink) 55%, transparent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--sky-ink) 30%, transparent),
    0 10px 24px rgba(70, 100, 150, 0.16);
}
.slot .wheel {
  max-width: 4.6rem;
}

/* Solved word: the wheel is replaced by the answer, calmly filled. */
.slot.done {
  cursor: default;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--lemon) 70%, #fff),
    color-mix(in srgb, var(--rose) 45%, #fff)
  );
}
.slot.done:active {
  transform: none;
}
.answer {
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ink);
  animation: answer-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes answer-in {
  from {
    transform: scale(0.7);
    opacity: 0;
  }
}

/* ── Active-word dock ─────────────────────────────────────────── */
.dock {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 1rem calc(1rem + env(safe-area-inset-bottom));
}
.track {
  display: flex;
  gap: 0.35rem;
  min-height: 2.4rem;
}
.track.full {
  animation: nudge 0.3s ease;
}
.tick {
  width: 1.9rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border-radius: 0.55rem;
  font-weight: 800;
  font-size: 1.2rem;
  text-transform: uppercase;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 -2px 0 rgba(120, 140, 180, 0.12);
}
.tick.set {
  background: linear-gradient(160deg, #fff, color-mix(in srgb, var(--sky) 55%, #fff));
  box-shadow:
    inset 0 1px 1px #fff,
    0 3px 8px rgba(70, 100, 150, 0.16);
  animation: pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pop {
  from {
    transform: scale(0.4);
  }
}
@keyframes nudge {
  50% {
    transform: translateY(-3px);
  }
}

.stage {
  width: min(72vw, 300px);
}
</style>
