<script setup>
import { computed } from 'vue';

const props = defineProps({
  elapsedMs: { type: Number, required: true },
  secret: { type: String, required: true },
});
defineEmits(['levels']);

const time = computed(() => {
  const total = Math.round(props.elapsedMs / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
});
</script>

<template>
  <div class="overlay">
    <div class="card glass">
      <div class="mark" aria-hidden="true">✓</div>
      <h1>Terminé</h1>
      <p class="sub">Mot secret&nbsp;: {{ secret }}</p>
      <div class="time">
        <span class="label">Temps</span>
        <span class="value">{{ time }}</span>
      </div>
      <button class="cta" type="button" @click="$emit('levels')">Autres niveaux</button>
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
  padding: 1.5rem;
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  animation: fade 0.4s ease;
}
@keyframes fade {
  from {
    opacity: 0;
  }
}

.card {
  position: relative;
  border-radius: 1.8rem;
  padding: 2.2rem 2.4rem 1.9rem;
  text-align: center;
  max-width: 88vw;
  animation: rise 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes rise {
  from {
    transform: translateY(26px) scale(0.92);
    opacity: 0;
  }
}
.mark {
  width: 3.4rem;
  height: 3.4rem;
  margin: 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 1.8rem;
  font-weight: 900;
  color: var(--bg);
  background: var(--sky-ink);
  animation: drop 0.6s cubic-bezier(0.34, 1.6, 0.5, 1) 0.1s both;
}
@keyframes drop {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  60% {
    transform: scale(1.08);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}
h1 {
  margin: 0.6rem 0 0;
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.sub {
  margin: 0.25rem 0 1.3rem;
  color: var(--muted);
  font-weight: 600;
}
.time {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.9rem 1.4rem;
  background: var(--tile);
  border: 1px solid var(--line);
  border-radius: 1.1rem;
  margin-bottom: 1.4rem;
}
.time .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
}
.time .value {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--sky-ink);
}
.cta {
  border: 0;
  background: var(--sky-ink);
  color: var(--bg);
  font-family: inherit;
  font-weight: 800;
  font-size: 1.02rem;
  padding: 0.85rem 1.9rem;
  border-radius: 1.1rem;
  cursor: pointer;
  transition: transform 0.12s ease;
}
.cta:active {
  transform: scale(0.96);
}
.cta:focus-visible {
  outline: 2px solid var(--sky-ink);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .mark {
    animation: none;
  }
}
</style>
