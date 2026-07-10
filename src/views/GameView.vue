<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameState } from '../composables/useGameState.js'
import { PUZZLES } from '../data/challenges.js'
import WordRow from '../components/WordRow.vue'
import SuccessScreen from '../components/SuccessScreen.vue'
import GiraffeMark from '../components/GiraffeMark.vue'

const route = useRoute()
const router = useRouter()

const levelIndex = Number(route.params.level)
if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= PUZZLES.length) {
  router.replace('/')
}

const g = useGameState(levelIndex)
const maxSlots = Math.max(...g.words.map((w) => w.slots.length))
const hasSelection = computed(() => g.state.selectedWord != null && !g.state.completed)

/* Physical keyboard: letters type into the selected word, Tab cycles words. */
function onKeydown(e) {
  if (g.state.completed) return
  if (e.key === 'Tab') {
    e.preventDefault()
    g.nextWord(e.shiftKey ? -1 : 1)
  } else if (e.key === ' ') {
    e.preventDefault()
    g.shuffleKeyboard()
  } else if (e.key === 'Backspace') {
    e.preventDefault()
    g.deleteLetter()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    g.moveCursor(-1)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    g.moveCursor(1)
  } else if (e.key === 'Escape') {
    g.clearWord()
  } else if (/^[a-zA-Zà-ÿÀ-ß]$/.test(e.key)) {
    if (g.state.selectedWord == null) g.selectWord(0)
    g.inputLetter(e.key)
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="game">
    <header class="top">
      <button class="icon-btn" type="button" @click="router.push('/')" aria-label="niveaux">←</button>
      <div class="titles">
        <h1><span class="mark"><GiraffeMark /></span>Mots Girafe</h1>
        <p class="date">Niveau {{ levelIndex + 1 }}</p>
      </div>
      <div class="icon-btn ghost" />
    </header>

    <div class="theme">
      <span class="theme-label">theme</span>
      <span class="theme-word">{{ g.theme }}</span>
    </div>

    <main class="list" :style="{ '--cell': `min(2.4rem, calc((min(100vw, 560px) - 1.6rem) / ${maxSlots} - 0.3rem))` }">
      <WordRow
        v-for="(w, i) in g.words"
        :key="i"
        :word="w"
        :input="g.inputs[i]"
        :word-index="i"
        :pool="g.poolFor(i)"
        :active="g.state.selectedWord === i"
        :active-slot="g.state.selectedWord === i ? g.state.selectedSlot : null"
        :solved="g.state.completed"
        @select-word="g.selectWord"
        @select-slot="g.selectSlot"
        @tap-letter="g.inputLetter"
      />
    </main>

    <Transition name="bar">
      <div v-if="hasSelection" class="controls">
        <button class="ctrl" type="button" @click="g.shuffleKeyboard">⇄ melanger</button>
        <button class="ctrl" type="button" @click="g.clearWord">✕ vider</button>
        <button class="ctrl" type="button" @click="g.deleteLetter">⌫ effacer</button>
      </div>
    </Transition>

    <SuccessScreen
      v-if="g.state.completed"
      :elapsed-ms="g.elapsedMs.value"
      :theme="g.theme"
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
.top { display: flex; align-items: center; gap: 0.6rem; padding: 0.9rem 1rem 0.3rem; }
.titles { flex: 1; text-align: center; }
.titles h1 {
  margin: 0; font-size: 1.4rem; color: var(--patch-dark); letter-spacing: 0.5px;
  display: inline-flex; align-items: center; gap: 0.4rem;
}
.mark { width: 1.4rem; height: 1.4rem; color: var(--orange); }
.date { margin: 0; font-size: 0.78rem; opacity: 0.6; }
.icon-btn {
  width: 2.5rem; height: 2.5rem; display: grid; place-items: center; font-size: 1.25rem;
  border: none; background: var(--cream-2); border-radius: 0.7rem;
  box-shadow: 0 3px 0 var(--patch-dark); cursor: pointer;
}
.icon-btn:active { transform: translateY(3px); box-shadow: none; }
.icon-btn.ghost { background: transparent; box-shadow: none; pointer-events: none; }

.theme {
  align-self: center;
  display: flex; align-items: baseline; gap: 0.5rem;
  margin: 0.3rem auto 0.2rem;
  padding: 0.45rem 1.2rem;
  background: var(--orange); color: #fff;
  border-radius: 0.8rem; box-shadow: 0 3px 0 var(--patch-dark);
}
.theme-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; }
.theme-word { font-size: 1.15rem; font-weight: 800; }

.list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: safe center;
  gap: 0.1rem;
  padding: 0.6rem 0.5rem 1rem;
}

.controls {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  padding: 0.7rem 0.8rem calc(0.7rem + env(safe-area-inset-bottom));
  background: var(--cream-2);
  border-top: 2px solid color-mix(in srgb, var(--patch) 40%, transparent);
  box-shadow: 0 -4px 16px rgba(90, 59, 30, 0.08);
}
.ctrl {
  flex: 1; max-width: 10rem;
  padding: 0.7rem 0.6rem;
  border: none; background: var(--orange); color: #fff;
  font-family: inherit; font-weight: 700; font-size: 0.95rem;
  border-radius: 0.8rem; box-shadow: 0 4px 0 var(--patch-dark); cursor: pointer;
}
.ctrl:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--patch-dark); }

.bar-enter-active, .bar-leave-active { transition: transform 0.25s ease; }
.bar-enter-from, .bar-leave-to { transform: translateY(100%); }
</style>
