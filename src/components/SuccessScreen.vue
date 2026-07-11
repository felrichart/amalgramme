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
      <div class="emoji">😎</div>
      <h1>Terminé</h1>
      <p class="sub">🔑 {{ secret }}</p>
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
  background: color-mix(in srgb, var(--paper) 55%, transparent);
  backdrop-filter: blur(8px);
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
.emoji {
  font-size: 3.6rem;
  line-height: 1;
  animation: drop 0.7s cubic-bezier(0.34, 1.6, 0.5, 1) 0.15s both;
}
@keyframes drop {
  0% {
    transform: translateY(-1.6rem) rotate(-10deg);
    opacity: 0;
  }
  60% {
    transform: translateY(0.15rem) rotate(3deg);
    opacity: 1;
  }
  100% {
    transform: translateY(0) rotate(0);
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
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--glass-brd);
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
  border: 1px solid var(--glass-brd);
  background: linear-gradient(160deg, #fff, color-mix(in srgb, var(--sky) 60%, #fff));
  color: var(--ink);
  font-family: inherit;
  font-weight: 800;
  font-size: 1.02rem;
  padding: 0.85rem 1.9rem;
  border-radius: 1.1rem;
  box-shadow: 0 8px 20px rgba(70, 100, 150, 0.18);
  cursor: pointer;
  transition:
    transform 0.12s ease,
    box-shadow 0.2s ease;
}
.cta:hover {
  box-shadow: 0 12px 26px rgba(70, 100, 150, 0.24);
}
.cta:active {
  transform: scale(0.96);
}
.cta:focus-visible {
  outline: 2px solid var(--sky-ink);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .emoji {
    animation: none;
  }
}
</style>
