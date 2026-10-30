<script setup>
/* The score on two digits, in the day's colour, over `max` when there's one;
 * `stacked` puts the max under the digits. A changed digit rolls up, then the
 * score pops. */
import { ref, computed, watch } from 'vue';

const props = defineProps({
  value: { type: Number, required: true },
  max: { type: Number, default: null },
  stacked: { type: Boolean, default: false },
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
const top = rolling(() => props.max);

const digits = computed(() => {
  const now = pad(props.value);
  const old = pad(score.from.value);
  return [...now].map((ch, i) => ({
    chars: score.changes.value && old[i] !== ch ? [old[i], ch] : [ch],
  }));
});
const label = computed(() => `score ${props.value}` + (props.max ? ` sur ${props.max}` : ''));
</script>

<template>
  <div class="score" :class="{ stacked }" :aria-label="label" role="status">
    <span :key="score.changes.value" class="digits" :class="{ pop: score.changes.value }">
      <span v-for="(d, i) in digits" :key="i" class="window">
        <span class="strip" :class="{ roll: d.chars.length > 1 }">
          <span v-for="(ch, j) in d.chars" :key="j" class="digit">{{ ch }}</span>
        </span>
      </span>
    </span>
    <span v-if="max" class="out-of" aria-hidden="true">
      <span :key="top.changes.value" class="max" :class="{ pop: top.changes.value }"
        >/{{ max }}</span
      >
    </span>
  </div>
</template>

<style scoped>
.score {
  display: flex;
  align-items: center;
  gap: 4px;
}
.stacked {
  flex-direction: column;
  gap: 0;
}
.stacked .out-of {
  align-self: center;
  margin: 2px 0 0;
}
.stacked .window,
.stacked .digit {
  height: 58px;
  line-height: 58px;
}
.stacked .digit {
  font-size: 52px;
}
.stacked .max {
  font-size: 22px;
}
.digits {
  display: flex;
}
.window {
  display: block;
  height: 38px;
  overflow: hidden;
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
  height: 38px;
  font-family: var(--dc-serif);
  font-size: 34px;
  line-height: 38px;
  color: var(--day);
}
.out-of {
  display: flex;
  align-items: center;
  gap: 4px;
  align-self: flex-end;
  margin-bottom: 5px;
  font-family: var(--dc-serif);
  color: var(--dc-faint);
}
.max {
  display: block;
  font-size: 20px;
  line-height: 1;
}
</style>
