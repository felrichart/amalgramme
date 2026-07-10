import { reactive, computed, watch, ref } from 'vue'
import { puzzleForDate, buildWords, shuffle, normalize } from '../game/puzzle.js'

const STORAGE_PREFIX = 'motsgirafe:v1:'

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key)) || null
  } catch {
    return null
  }
}
function save(key, data) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data))
  } catch {
    /* storage full or unavailable: play without persistence */
  }
}

/*
 * Owns all mutable state for one day's challenge: 7 equal words linked by a
 * theme (shown as a free hint). Words are only judged once every cell is full.
 */
export function useGameState(dateKey) {
  const puzzle = puzzleForDate(dateKey)
  const words = buildWords(puzzle)
  const theme = puzzle.theme

  const saved = load(dateKey)

  const inputs = reactive(saved?.inputs ?? words.map((w) => Array(w.length).fill('')))
  const shuffleSeeds = reactive(saved?.shuffleSeeds ?? words.map((_, i) => i + 1))

  const state = reactive({
    selectedWord: saved?.completed ? null : 0,
    selectedSlot: 0,
    completed: saved?.completed ?? false,
    startTime: saved?.startTime ?? null,
    endTime: saved?.endTime ?? null,
  })

  /* --- derived --- */

  const wordFull = (w) => inputs[w].every((c) => c !== '')
  const wordCorrect = (w) => inputs[w].join('') === words[w].answer

  /* Shuffled letter tiles for a word + which tiles are already used (greyed). */
  function poolFor(w) {
    const seed = shuffleSeeds[w]
    const base = words[w].answer.split('').map((letter, id) => ({ letter, id }))
    const placed = {}
    for (const c of inputs[w]) if (c) placed[c] = (placed[c] || 0) + 1
    const used = new Set()
    const byLetter = {}
    for (const t of base) (byLetter[t.letter] ||= []).push(t.id)
    for (const [letter, ids] of Object.entries(byLetter)) {
      ids.slice(0, placed[letter] || 0).forEach((id) => used.add(id))
    }
    return { tiles: shuffle(base, seed), used }
  }

  function remaining(w, letter) {
    const total = words[w].answer.split('').filter((c) => c === letter).length
    const placed = inputs[w].filter((c) => c === letter).length
    return total - placed
  }

  /* --- actions --- */

  function ensureStarted() {
    if (state.startTime == null) state.startTime = Date.now()
  }
  function firstEmptySlot(w) {
    const i = inputs[w].findIndex((c) => c === '')
    return i === -1 ? null : i
  }
  function nextEmptySlot(w, from) {
    const n = inputs[w].length
    for (let k = 0; k < n; k++) {
      const i = (from + k) % n
      if (inputs[w][i] === '') return i
    }
    return null
  }

  function selectWord(w) {
    if (state.completed) return
    state.selectedWord = w
    state.selectedSlot = firstEmptySlot(w) ?? 0
  }
  function selectSlot(w, letterIndex) {
    if (state.completed) return
    state.selectedWord = w
    state.selectedSlot = letterIndex
  }
  function nextWord(step = 1) {
    if (state.completed) return
    const cur = state.selectedWord ?? -1
    selectWord(((cur + step) % words.length + words.length) % words.length)
  }
  function moveCursor(dir) {
    if (state.completed || state.selectedWord == null) return
    const n = inputs[state.selectedWord].length
    state.selectedSlot = Math.min(n - 1, Math.max(0, (state.selectedSlot ?? 0) + dir))
  }

  function inputLetter(rawLetter) {
    if (state.completed || state.selectedWord == null || state.selectedSlot == null) return
    const letter = normalize(rawLetter)
    if (letter.length !== 1) return
    const w = state.selectedWord
    const slot = state.selectedSlot
    if (inputs[w][slot] === letter) {
      state.selectedSlot = nextEmptySlot(w, slot + 1) ?? slot
      return
    }
    if (remaining(w, letter) <= 0) return
    inputs[w][slot] = letter
    ensureStarted()
    state.selectedSlot = nextEmptySlot(w, slot + 1) ?? slot
    checkAllOrMiss()
  }

  /* Backspace: clear the current cell, or step back and clear the previous one. */
  function deleteLetter() {
    if (state.completed || state.selectedWord == null) return
    const w = state.selectedWord
    const slot = state.selectedSlot ?? inputs[w].length - 1
    if (inputs[w][slot] !== '') {
      inputs[w][slot] = ''
    } else if (slot > 0) {
      inputs[w][slot - 1] = ''
      state.selectedSlot = slot - 1
    }
  }

  function clearWord() {
    if (state.completed || state.selectedWord == null) return
    const w = state.selectedWord
    inputs[w] = Array(words[w].length).fill('')
    state.selectedSlot = 0
  }

  function shuffleKeyboard() {
    if (state.selectedWord == null) return
    shuffleSeeds[state.selectedWord] = shuffleSeeds[state.selectedWord] * 2 + 7
  }

  const missSignal = ref(0)
  function checkAllOrMiss() {
    if (state.completed) return
    if (!words.every((_, w) => wordFull(w))) return
    if (words.every((_, w) => wordCorrect(w))) {
      state.completed = true
      state.endTime = Date.now()
      state.selectedWord = null
      state.selectedSlot = null
    } else {
      missSignal.value++
    }
  }

  const elapsedMs = computed(() =>
    state.startTime && state.endTime ? state.endTime - state.startTime : 0
  )

  watch(
    () => JSON.stringify({ inputs, shuffleSeeds, s: state }),
    () => save(dateKey, {
      inputs, shuffleSeeds,
      completed: state.completed, startTime: state.startTime, endTime: state.endTime,
    })
  )

  return {
    puzzle, words, theme, inputs, state, missSignal, elapsedMs,
    wordFull, wordCorrect, poolFor, remaining,
    selectWord, selectSlot, nextWord, moveCursor,
    inputLetter, deleteLetter, clearWord, shuffleKeyboard,
  }
}
