<script setup>
import { onMounted, onUnmounted } from 'vue';

const emit = defineEmits(['close']);

/* Escape closes, matching the icon-btn and backdrop. */
function onKeydown(e) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div class="scrim" @click.self="emit('close')">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Comment jouer">
        <header class="head">
          <h2 class="heading">Comment jouer</h2>
          <button class="close" type="button" @click="emit('close')" aria-label="fermer">×</button>
        </header>

        <ol class="steps">
          <li>
            <span class="num">1</span>
            <p>Chaque roue cache un mot : glisse d'une lettre à l'autre pour le tracer.</p>
          </li>
          <li>
            <span class="num">2</span>
            <p>Au centre, devine le mot secret à partir des lettres des quatre autres mots.</p>
          </li>
          <li>
            <span class="num">3</span>
            <p>Trouve les cinq mots : le mot du centre est le lien entre les quatre autres.</p>
          </li>
        </ol>

        <button class="cta" type="button" @click="emit('close')">C'est parti</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1.2rem;
  background: rgba(22, 24, 31, 0.5);
  animation: fade 0.15s ease;
}
.sheet {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 1.4rem;
  border-radius: 1.3rem;
  background: var(--panel);
  border: var(--outline-w-lg) solid var(--outline);
  box-shadow: var(--pop-lg);
  animation: pop-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.heading {
  flex: 1;
  margin: 0;
  font-size: 1.35rem;
  font-weight: 900;
  color: var(--ink);
}
.close {
  width: 2.2rem;
  height: 2.2rem;
  flex: none;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  line-height: 1;
  border-radius: 0.7rem;
  color: var(--ink);
  cursor: pointer;
  background: var(--panel);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.close:active {
  transform: translate(3px, 4px);
  box-shadow: 0 0 0 var(--outline);
}

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.num {
  width: 2rem;
  height: 2rem;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-weight: 900;
  font-size: 1.05rem;
  color: #fff;
  background: var(--accent);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop-sm);
}
.steps p {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--ink);
}

.cta {
  align-self: stretch;
  background: var(--accent);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 1.05rem;
  padding: 0.9rem 1.9rem;
  border-radius: 1.1rem;
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--pop);
  cursor: pointer;
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}
.cta:active {
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}
.cta:focus-visible {
  outline: none;
  transform: translate(4px, 5px);
  box-shadow: 0 0 0 var(--outline);
}

@keyframes fade {
  from {
    opacity: 0;
  }
}
@keyframes pop-in {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
}
</style>
