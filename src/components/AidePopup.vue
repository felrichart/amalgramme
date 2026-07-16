<script setup>
/* The "Aide" popup, opened from the lightbulb in the game header. It always
 * offers both reveals — a letter of an indice, a letter of the énigme — each
 * disabled once nothing's left to uncover there (or no reveals remain) — plus a
 * dismiss. The parent owns the reveal (emits `reveal` with 'word' | 'secret'),
 * the can-reveal flags, the remaining count and the open flag; this is purely
 * presentational. */
defineProps({
  open: { type: Boolean, default: false },
  /* Whether each reveal is still available (drives its button's disabled state). */
  canWord: { type: Boolean, default: false },
  canSecret: { type: Boolean, default: false },
  /* Reveals the player has left. */
  left: { type: Number, default: 0 },
});
const emit = defineEmits(['reveal', 'close']);
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Aide">
      <div class="bulb" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30">
          <path
            d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2h5c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <h2 class="title">Besoin d’aide ?</h2>
      <p class="sub">
        Révèle une lettre pour te débloquer.
        <br />
        Il te reste {{ left }} aide{{ left > 1 ? 's' : '' }}.
      </p>
      <div class="actions">
        <button
          class="cta cta-hint"
          type="button"
          :disabled="!canWord"
          @click="emit('reveal', 'word')"
        >
          Révéler une lettre d’un indice
        </button>
        <button
          class="cta cta-hint"
          type="button"
          :disabled="!canSecret"
          @click="emit('reveal', 'secret')"
        >
          Révéler une lettre de l’énigme
        </button>
        <button class="cta cta-ghost" type="button" @click="emit('close')">
          Pas besoin d’aide
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.2rem;
  background: rgba(22, 24, 31, 0.45);
}
.modal {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  padding: 1.6rem 1.4rem;
  border-radius: 1.3rem;
  background: var(--panel);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop-lg);
}
.bulb {
  display: grid;
  place-items: center;
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 50%;
  color: #fff;
  background: var(--lime);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.title {
  margin: 0;
  text-align: center;
  font-size: 1.2rem;
  font-weight: 900;
}
.sub {
  margin: 0;
  text-align: center;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--muted);
  line-height: 1.35;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
  margin-top: 0.4rem;
}
.cta {
  width: 100%;
  font-family: inherit;
  font-weight: 900;
  font-size: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  cursor: pointer;
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.cta:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}
.cta:disabled {
  cursor: default;
  opacity: 0.4;
  transform: none;
  box-shadow: 0 0 0 var(--outline);
}
.cta-hint {
  background: var(--lime);
  color: #fff;
}
.cta-ghost {
  background: var(--panel);
  color: var(--ink);
}
</style>
