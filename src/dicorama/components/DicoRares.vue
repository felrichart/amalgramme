<script setup>
/* The rare words found, over the board, as the list shows its words (tap one for
 * its definition and other forms), and whether they're all found; a tap outside
 * closes it. */
import DicoList from './DicoList.vue';
import DicoBook from './DicoBook.vue';

const props = defineProps({
  // Rows of listOf, rare ones.
  rows: { type: Array, required: true },
  complete: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);
const n = props.rows.length;
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="card" role="dialog" aria-modal="true" aria-label="Mots rares">
      <header class="head">
        <DicoBook class="book" />
        <h2 class="title">Mots rares</h2>
        <span class="count">{{ n }} trouvé{{ n > 1 ? 's' : '' }}</span>
      </header>
      <p v-if="complete" class="done">
        <DicoBook gold class="gold" />Tous les mots rares sont trouvés&#8239;!
      </p>
      <DicoList class="words" :rows="rows" />
      <button class="dc-button quiet" type="button" @click="emit('close')">Fermer</button>
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
  padding: 20px;
  background: rgb(30 26 20 / 0.42);
  animation: dico-appear 0.18s ease-out both;
}
.card {
  width: 100%;
  max-width: 340px;
  max-height: calc(100dvh - 40px);
  padding: 20px 16px 18px;
  border-radius: 22px;
  background: var(--dc-board);
  box-shadow:
    inset 0 -4px 0 var(--dc-board-edge),
    0 18px 40px rgb(0 0 0 / 0.25);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}
.book {
  font-size: 20px;
}
.title {
  flex: 1;
  margin: 0;
  font-family: var(--dc-serif);
  font-weight: 400;
  font-size: 24px;
  color: var(--day);
}
.count {
  font-size: 13px;
  font-weight: 600;
  color: var(--dc-faint);
}
.done {
  margin: 0 4px;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 700;
  color: var(--dc-day-ink);
}
.gold {
  font-size: 20px;
  color: var(--dc-yellow);
  filter: drop-shadow(0 0.05em 0 rgb(60 40 0 / 0.55));
}
.card .words {
  flex: 0 1 auto;
  min-height: 64px;
}
</style>
