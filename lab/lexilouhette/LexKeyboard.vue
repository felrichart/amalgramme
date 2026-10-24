<script setup>
/* On-screen AZERTY keyboard. */
import EditIcon from '../../src/components/ui/EditIcon.vue';

const ROWS = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
const emit = defineEmits(['key', 'back']);
</script>

<template>
  <div class="keyboard">
    <div v-for="(row, r) in ROWS" :key="r" class="krow">
      <button
        v-for="ch in row"
        :key="ch"
        class="key press sm"
        type="button"
        tabindex="-1"
        @click="emit('key', ch)"
      >
        {{ ch }}
      </button>
      <button
        v-if="r === ROWS.length - 1"
        class="key wide press sm"
        type="button"
        tabindex="-1"
        aria-label="effacer une lettre"
        @click="emit('back')"
      >
        <EditIcon name="back" :size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.keyboard {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  user-select: none;
}
.krow {
  display: flex;
  justify-content: center;
  gap: 0.3rem;
}
.key {
  flex: 0 1 2.6rem;
  min-width: 0;
  height: 3.1rem;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 0.6rem;
  font-weight: 900;
  font-size: 1.15rem;
  color: var(--ink);
  background: var(--panel);
}
.key.wide {
  flex-basis: 4.2rem;
}
</style>
