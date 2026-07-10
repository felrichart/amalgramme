<script setup>
import { computed } from 'vue'
import GiraffeMark from './GiraffeMark.vue'

const props = defineProps({
  elapsedMs: { type: Number, required: true },
  theme: { type: String, required: true },
})
defineEmits(['levels'])

const time = computed(() => {
  const total = Math.round(props.elapsedMs / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`
})

/* Confetti spots (runtime randomness is fine in the browser). */
const spots = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 0.6,
  dur: 2.2 + Math.random() * 1.8,
  size: 10 + Math.random() * 22,
  rot: Math.random() * 360,
}))
</script>

<template>
  <div class="overlay">
    <div class="confetti">
      <span
        v-for="s in spots"
        :key="s.id"
        class="spot"
        :style="{
          left: s.left + '%',
          width: s.size + 'px',
          height: s.size + 'px',
          animationDelay: s.delay + 's',
          animationDuration: s.dur + 's',
          '--rot': s.rot + 'deg',
        }"
      />
    </div>

    <div class="card">
      <div class="emoji"><GiraffeMark /></div>
      <h1>Bravo !</h1>
      <p class="sub">{{ theme }}</p>
      <div class="time">
        <span class="label">Temps</span>
        <span class="value">{{ time }}</span>
      </div>
      <button class="cta" type="button" @click="$emit('levels')">
        Autres niveaux
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--cream) 82%, transparent);
  backdrop-filter: blur(4px);
  animation: fade 0.4s ease;
  overflow: hidden;
}
@keyframes fade { from { opacity: 0; } }

.card {
  position: relative;
  z-index: 2;
  background: var(--cream-2);
  border: 3px solid var(--patch);
  border-radius: 2rem;
  padding: 2rem 2.4rem;
  text-align: center;
  box-shadow: 0 12px 36px rgba(90, 59, 30, 0.25);
  animation: rise 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-width: 88vw;
}
@keyframes rise {
  from { transform: translateY(30px) scale(0.9); opacity: 0; }
}
.emoji {
  width: 4.5rem;
  height: 4.5rem;
  margin: 0 auto;
  color: var(--orange);
  animation: bob 2s ease-in-out infinite;
}
@keyframes bob { 50% { transform: translateY(-8px) rotate(-4deg); } }
h1 {
  margin: 0.2rem 0 0;
  font-size: 2.2rem;
  color: var(--patch-dark);
  letter-spacing: 0.5px;
}
.sub { margin: 0.2rem 0 1.1rem; color: var(--ink); opacity: 0.7; }
.time {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.9rem 1.4rem;
  background: var(--cream);
  border-radius: 1.2rem;
  margin-bottom: 1.3rem;
}
.time .label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; }
.time .value { font-size: 1.9rem; font-weight: 800; color: var(--orange); }
.cta {
  border: none;
  background: var(--orange);
  color: #fff;
  font-family: inherit;
  font-weight: 700;
  font-size: 1.05rem;
  padding: 0.8rem 1.8rem;
  border-radius: 1.2rem;
  box-shadow: 0 4px 0 var(--patch-dark);
  cursor: pointer;
}
.cta:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--patch-dark); }

.confetti { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.spot {
  position: absolute;
  top: -8%;
  background: var(--patch);
  border-radius: 46% 54% 61% 39% / 52% 44% 56% 48%;
  animation-name: fall;
  animation-timing-function: ease-in;
  animation-iteration-count: 1;
  opacity: 0.9;
}
.spot:nth-child(3n) { background: var(--orange); }
.spot:nth-child(3n+1) { background: var(--tan); }
@keyframes fall {
  to { transform: translateY(112vh) rotate(var(--rot)); opacity: 0; }
}
</style>
