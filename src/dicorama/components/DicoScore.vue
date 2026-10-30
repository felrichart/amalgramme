<script setup>
/* The score on two digits, in the day's colour, and the yellow bonus tag from the
 * first rare word. A changed digit rolls up, then the score pops. */
import { ref, computed, watch } from 'vue';

const props = defineProps({
  value: { type: Number, required: true },
  bonus: { type: Number, default: 0 },
});

const pad = (n) => String(n).padStart(2, '0');

/* `changes` counts the changes, to replay the animation; `from` is the old value. */
function rolling(source) {
  const from = ref(source());
  const changes = ref(0);
  watch(source, (now, old) => {
    from.value = old;
    changes.value++;
  });
  return { from, changes };
}
const score = rolling(() => props.value);
const extra = rolling(() => props.bonus);

const digits = computed(() => {
  const now = pad(props.value);
  const old = pad(score.from.value);
  return [...now].map((ch, i) => ({
    chars: score.changes.value && old[i] !== ch ? [old[i], ch] : [ch],
  }));
});
const bonusChars = computed(() =>
  extra.changes.value && extra.from.value !== props.bonus
    ? [String(extra.from.value), String(props.bonus)]
    : [String(props.bonus)],
);
</script>

<template>
  <div class="score" :aria-label="`score ${value}${bonus ? `, bonus ${bonus}` : ''}`" role="status">
    <span :key="score.changes.value" class="digits" :class="{ pop: score.changes.value }">
      <span v-for="(d, i) in digits" :key="i" class="window">
        <span class="strip" :class="{ roll: d.chars.length > 1 }">
          <span v-for="(ch, j) in d.chars" :key="j" class="digit">{{ ch }}</span>
        </span>
      </span>
    </span>
    <span
      v-if="bonus"
      :key="`b${extra.changes.value}`"
      class="bonus"
      :class="{ pop: extra.changes.value }"
    >
      <span class="plus" aria-hidden="true" />
      <span class="window small">
        <span class="strip" :class="{ roll: bonusChars.length > 1 }">
          <span v-for="(ch, j) in bonusChars" :key="j" class="digit small">{{ ch }}</span>
        </span>
      </span>
    </span>
  </div>
</template>

<style scoped>
.score {
  display: flex;
  align-items: center;
  gap: 10px;
}
.digits {
  display: flex;
}
.window {
  display: block;
  height: 48px;
  overflow: hidden;
}
.window.small {
  height: 20px;
}
.strip {
  display: flex;
  flex-direction: column;
}
.roll {
  animation: dico-roll 0.36s cubic-bezier(0.3, 0.7, 0.3, 1) both;
}
.pop {
  animation: dico-pop 0.34s ease-out 220ms both;
}
.digit {
  display: block;
  height: 48px;
  font-family: var(--dc-serif);
  font-size: 44px;
  line-height: 48px;
  color: var(--day);
}
.digit.small {
  height: 20px;
  font-family: var(--dc-mono);
  font-weight: 700;
  font-size: 20px;
  line-height: 20px;
  color: var(--dc-yellow-ink);
}
.bonus {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 26px;
  padding: 0 7px;
  border-radius: 6px;
  background: var(--dc-yellow);
  box-shadow: 0 1px 0 rgb(60 40 0 / 0.5);
}
.plus {
  display: block;
  width: 11px;
  height: 11px;
  background:
    linear-gradient(var(--dc-yellow-ink), var(--dc-yellow-ink)) center / 100% 2.5px no-repeat,
    linear-gradient(var(--dc-yellow-ink), var(--dc-yellow-ink)) center / 2.5px 100% no-repeat;
}
</style>
