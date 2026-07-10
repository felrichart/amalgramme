import { reactive, computed, watch, ref } from 'vue'
import { puzzleForLevel, buildWords, shuffle, normalize } from '../game/puzzle.js'

const STORAGE_PREFIX = 'lexicool:v2:level:'

/* Progress summary for a level, read by the level-select screen. */
export function levelProgress(idx) {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_PREFIX + idx))
    return { found: s?.found ?? 0, completed: !!s?.completed }
  } catch {
    return { found: 0, completed: false }
  }
}

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
 * Owns all mutable state for one level: 6 words linked by a theme (shown as a
 * free hint). Each word is spelled by drawing a path through its letter wheel.
 * A word is judged only once every letter is used; a wrong full path shakes,
 * a path released early is silently dropped.
 */
export function useGameState(levelIndex) {
  const puzzle = puzzleForLevel(levelIndex)
  const words = buildWords(puzzle)
  const theme = puzzle.theme

  const saved = load(levelIndex)

  const solved = reactive(saved?.solved ?? words.map(() => false))
  const shuffleSeeds = reactive(saved?.shuffleSeeds ?? words.map((_, i) => i + 1))

  const firstUnsolved = () => {
    const i = solved.findIndex((s) => !s)
    return i === -1 ? null : i
  }
  /* Next open word after `from`, wrapping around; null when all are solved. */
  const nextUnsolved = (from) => {
    const n = solved.length
    for (let s = 1; s <= n; s++) {
      const i = (from + s) % n
      if (!solved[i]) return i
    }
    return null
  }

  const state = reactive({
    active: saved?.completed ? null : firstUnsolved(),
    completed: saved?.completed ?? false,
    startTime: saved?.startTime ?? null,
    endTime: saved?.endTime ?? null,
  })

  /* Tile ids drawn so far for the active word, in order. */
  const path = reactive([])
  /* Bumped whenever a full-but-wrong word is committed, so the wheel can shake. */
  const shakeSignal = ref(0)

  /* --- derived --- */

  /* The active word's letters arranged around the wheel, per its shuffle seed. */
  function wheelTiles(w) {
    return shuffle(words[w].letters, shuffleSeeds[w])
  }

  const current = computed(() => {
    if (state.active == null) return ''
    const byId = Object.fromEntries(words[state.active].letters.map((t) => [t.id, t.ch]))
    return path.map((id) => byId[id]).join('')
  })

  const elapsedMs = computed(() =>
    state.startTime && state.endTime ? state.endTime - state.startTime : 0
  )
  const foundCount = () => solved.filter(Boolean).length

  /* --- actions --- */

  function ensureStarted() {
    if (state.startTime == null) state.startTime = Date.now()
  }

  /* Promote a word to the big wheel; tapping a solved word is a no-op. */
  function activate(w) {
    if (state.completed || solved[w]) return
    if (state.active !== w) {
      state.active = w
      path.length = 0
    }
  }

  function shuffleWheel() {
    if (state.active == null) return
    shuffleSeeds[state.active] = (shuffleSeeds[state.active] * 2 + 7) % 100000 || 1
  }

  /* Begin a fresh draw (finger pressed down). */
  function beginPath() {
    path.length = 0
  }

  /* Extend the draw onto a tile; repeats and re-entry are ignored. */
  function appendTile(id) {
    if (state.active == null || path.includes(id)) return
    path.push(id)
    ensureStarted()
  }

  function clearPath() {
    path.length = 0
  }

  /* Keyboard entry: consume the next unused tile matching the typed letter. */
  function typeLetter(raw) {
    if (state.active == null) return
    const ch = normalize(raw)
    if (ch.length !== 1) return
    const t = words[state.active].letters.find((t) => t.ch === ch && !path.includes(t.id))
    if (!t) return
    appendTile(t.id)
    if (path.length === words[state.active].length) commit()
  }

  function backspace() {
    path.pop()
  }

  /*
   * Finger released (or word typed in full). Correct → lock the word and hop to
   * the next open one; full but wrong → shake; anything shorter → drop.
   */
  function commit() {
    const w = state.active
    if (w == null) return
    if (current.value === words[w].text) {
      solved[w] = true
      path.length = 0
      const nxt = nextUnsolved(w)
      if (nxt == null) finish()
      else state.active = nxt
    } else if (path.length === words[w].length) {
      shakeSignal.value++
      path.length = 0
    } else {
      path.length = 0
    }
  }

  function finish() {
    state.completed = true
    state.active = null
    state.endTime = Date.now()
  }

  watch(
    () => JSON.stringify({ solved, shuffleSeeds, s: state }),
    () =>
      save(levelIndex, {
        solved: [...solved],
        shuffleSeeds: [...shuffleSeeds],
        found: foundCount(),
        completed: state.completed,
        startTime: state.startTime,
        endTime: state.endTime,
      })
  )

  return {
    puzzle, words, theme, state, path, current, solved, shakeSignal, elapsedMs,
    wheelTiles, activate, shuffleWheel, beginPath, appendTile, clearPath,
    typeLetter, backspace, commit,
  }
}
