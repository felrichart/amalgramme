<script setup>
/* The on-screen AZERTY keyboard, with "clear all" and "erase" on its last row. */
defineProps({ disabled: { type: Boolean, default: false } });
const emit = defineEmits(['key', 'back', 'clear']);

const ROWS = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
</script>

<template>
  <div class="keyboard" :class="{ disabled }">
    <div v-for="(row, r) in ROWS" :key="r" class="krow">
      <button
        v-if="r === 2"
        class="key wide"
        type="button"
        tabindex="-1"
        aria-label="tout effacer"
        :disabled="disabled"
        @click="emit('clear')"
      >
        <span class="cap">
          <svg
            width="23"
            height="23"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12a8 8 0 1 0 2.4-5.7" />
            <path d="M4 4v4.5h4.5" />
          </svg>
        </span>
      </button>
      <button
        v-for="ch in row"
        :key="ch"
        class="key"
        type="button"
        tabindex="-1"
        :disabled="disabled"
        @click="emit('key', ch)"
      >
        <span class="cap letter">{{ ch }}</span>
      </button>
      <button
        v-if="r === 2"
        class="key wide"
        type="button"
        tabindex="-1"
        aria-label="effacer une lettre"
        :disabled="disabled"
        @click="emit('back')"
      >
        <span class="cap">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
            <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
          </svg>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.keyboard {
  display: flex;
  flex-direction: column;
  gap: clamp(7px, 1.1dvh, 11px);
  padding-top: 2px;
}
.krow {
  display: flex;
  gap: 5px;
}
.key {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  /* Taller on taller screens: 40px on a short one, up to 56px. */
  height: clamp(40px, 6.2dvh, 56px);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}
.key.wide {
  flex-grow: 1.5;
}
.cap {
  position: absolute;
  inset: 0 0 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #f7f3eb;
  color: var(--dc-ink);
  box-shadow:
    0 3px 0 #b3ab9a,
    0 4px 6px rgb(0 0 0 / 0.06);
  transition: transform 0.07s;
}
.wide .cap {
  background: #ddd6c8;
  color: #2f2b25;
  box-shadow: 0 3px 0 #a9a191;
}
.letter {
  font-family: var(--dc-serif);
  font-size: clamp(19px, 2.7dvh, 24px);
  line-height: 1;
}
.key:active:not(:disabled) .cap {
  transform: translateY(3px);
  box-shadow: none;
}
.disabled {
  opacity: 0.45;
}
.key:disabled {
  cursor: default;
}
</style>
