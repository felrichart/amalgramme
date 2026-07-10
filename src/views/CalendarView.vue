<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { toKey, todayKey, isPlayable, MONTHS_FR } from '../utils/dates.js'
import { FIRST_DATE } from '../data/challenges.js'

const router = useRouter()
const today = todayKey()
const firstDate = FIRST_DATE

const view = ref(new Date())
view.value.setDate(1)

const year = computed(() => view.value.getFullYear())
const month = computed(() => view.value.getMonth())
const monthLabel = computed(() => `${MONTHS_FR[month.value]} ${year.value}`)

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/* Cells for the visible month, Monday-first, with leading blanks. */
const cells = computed(() => {
  const first = new Date(year.value, month.value, 1)
  const lead = (first.getDay() + 6) % 7 // Mon = 0
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
  const out = []
  for (let i = 0; i < lead; i++) out.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(new Date(year.value, month.value, d))
    out.push({
      day: d,
      key,
      playable: isPlayable(key),
      today: key === today,
      done: isDone(key),
    })
  }
  return out
})

function isDone(key) {
  try {
    return !!JSON.parse(localStorage.getItem('motsgirafe:v1:' + key))?.completed
  } catch {
    return false
  }
}

function step(delta) {
  const d = new Date(view.value)
  d.setMonth(d.getMonth() + delta)
  view.value = d
}
const canPrev = computed(() => `${year.value}-${String(month.value + 1).padStart(2, '0')}` > firstDate.slice(0, 7))
const canNext = computed(() => `${year.value}-${String(month.value + 1).padStart(2, '0')}` < today.slice(0, 7))

function open(cell) {
  if (cell?.playable) router.push('/play/' + cell.key)
}
</script>

<template>
  <div class="cal">
    <header class="top">
      <button class="icon-btn" type="button" @click="router.push('/')" aria-label="retour">←</button>
      <h1>Defis</h1>
      <div class="icon-btn ghost" />
    </header>

    <div class="nav">
      <button class="nav-btn" type="button" :disabled="!canPrev" @click="step(-1)">‹</button>
      <span class="month">{{ monthLabel }}</span>
      <button class="nav-btn" type="button" :disabled="!canNext" @click="step(1)">›</button>
    </div>

    <div class="grid weekdays">
      <span v-for="(w, i) in WEEKDAYS" :key="i" class="wd">{{ w }}</span>
    </div>
    <div class="grid days">
      <template v-for="(c, i) in cells" :key="i">
        <span v-if="!c" class="blank" />
        <button
          v-else
          class="cell"
          :class="{ playable: c.playable, locked: !c.playable, today: c.today, done: c.done }"
          type="button"
          :disabled="!c.playable"
          @click="open(c)"
        >
          <span class="num">{{ c.day }}</span>
          <span v-if="c.done" class="check">🦒</span>
        </button>
      </template>
    </div>

    <p class="foot">Un nouveau defi chaque jour. Rejoue les jours passes !</p>
  </div>
</template>

<style scoped>
.cal { max-width: 480px; margin: 0 auto; padding: 1rem 1rem 2rem; }
.top { display: flex; align-items: center; gap: 0.6rem; }
.top h1 { flex: 1; text-align: center; margin: 0; color: var(--patch-dark); font-size: 1.5rem; }
.icon-btn {
  width: 2.6rem; height: 2.6rem; display: grid; place-items: center;
  font-size: 1.3rem; border: none; background: var(--cream-2);
  border-radius: 50%; box-shadow: 0 3px 0 var(--patch-dark); cursor: pointer; color: var(--ink);
}
.icon-btn:active { transform: translateY(3px); box-shadow: none; }
.icon-btn.ghost { background: transparent; box-shadow: none; pointer-events: none; }

.nav { display: flex; align-items: center; justify-content: center; gap: 1.2rem; margin: 1.2rem 0; }
.month { font-size: 1.2rem; font-weight: 800; text-transform: capitalize; min-width: 9rem; text-align: center; }
.nav-btn {
  width: 2.4rem; height: 2.4rem; border: none; background: var(--tan); color: var(--ink);
  font-size: 1.4rem; font-weight: 800; border-radius: 50%; cursor: pointer;
  box-shadow: 0 3px 0 var(--patch-dark);
}
.nav-btn:disabled { opacity: 0.3; box-shadow: none; cursor: default; }
.nav-btn:not(:disabled):active { transform: translateY(3px); box-shadow: none; }

.grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.4rem; }
.weekdays { margin-bottom: 0.4rem; }
.wd { text-align: center; font-size: 0.8rem; font-weight: 700; opacity: 0.5; }
.blank { aspect-ratio: 1; }
.cell {
  position: relative;
  aspect-ratio: 1;
  border: none;
  background: var(--cream-2);
  border-radius: 0.5rem;
  font-family: inherit;
  font-weight: 700;
  font-size: 1rem;
  color: var(--ink);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.12s ease;
}
.cell.playable { box-shadow: inset 0 0 0 2px var(--patch); }
.cell.playable:active { transform: scale(0.9); }
.cell.locked { opacity: 0.3; cursor: default; }
.cell.today { background: var(--accent); box-shadow: inset 0 0 0 2.5px var(--patch-dark); }
.cell.done { background: var(--patch); color: var(--cream); }
.cell.done .num { opacity: 0.55; font-size: 0.75rem; position: absolute; top: 4px; left: 7px; }
.check { font-size: 1.3rem; }

.foot { text-align: center; opacity: 0.5; font-size: 0.85rem; margin-top: 1.6rem; }
</style>
