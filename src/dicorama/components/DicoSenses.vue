<script setup>
/* A word's definition in the editor, and the Wiktionnaire sense to pick for it,
 * saved for that word in every level at once. */
import { ref, computed } from 'vue';
import { official, setDefinition } from '../store.js';
import { sensesOf, defaultSense } from '../definitions.js';

const props = defineProps({ word: { type: String, required: true } });

// null while loading, false when the request failed.
const senses = ref(null);
const open = ref(false);
const error = ref('');
sensesOf(props.word).then(
  (list) => (senses.value = list),
  () => (senses.value = false),
);

const fallback = computed(() => (senses.value ? defaultSense(senses.value) : -1));
const picked = computed(() => official.definitions[props.word]?.index ?? fallback.value);
const text = computed(
  () => official.definitions[props.word]?.text ?? senses.value?.[fallback.value]?.text,
);

async function pick(index) {
  const choice = index === fallback.value ? null : { index, text: senses.value[index].text };
  const res = await setDefinition(props.word, choice);
  error.value = res.ok ? '' : res.error;
  if (res.ok) open.value = false;
}
</script>

<template>
  <div class="definition">
    <p class="current">
      <em class="word">{{ word }}</em>
      <span v-if="senses === null" class="muted">chargement…</span>
      <span v-else-if="senses === false" class="muted">Wiktionnaire injoignable</span>
      <span v-else-if="text">{{ text }}</span>
      <span v-else class="muted">aucune définition</span>
      <button v-if="senses && senses.length > 1" class="change" type="button" @click="open = !open">
        {{ open ? 'fermer' : `changer (${picked + 1}/${senses.length})` }}
      </button>
    </p>
    <ol v-if="open" class="senses">
      <li v-for="(s, i) in senses" :key="i">
        <button class="sense" :class="{ on: i === picked }" type="button" @click="pick(i)">
          <span class="index">{{ i + 1 }}</span>
          <span>{{ s.text }}</span>
          <span v-if="i === fallback" class="tag">par défaut</span>
        </button>
      </li>
    </ol>
    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>

<style scoped>
.definition {
  font-size: 0.8rem;
  line-height: 1.3;
  color: var(--ink);
}
.current {
  margin: 0;
}
.word {
  margin-right: 0.35em;
  font-weight: 800;
}
.muted {
  color: var(--muted);
  font-style: italic;
}
.change {
  margin-left: 0.4em;
  padding: 0;
  font: inherit;
  font-weight: 800;
  color: var(--muted);
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
}
.senses {
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.sense {
  width: 100%;
  display: flex;
  gap: 0.5em;
  padding: 0.35rem 0.5rem;
  font: inherit;
  text-align: left;
  color: var(--ink);
  background: var(--panel);
  border: 1.5px solid var(--line);
  border-radius: 0.5rem;
  cursor: pointer;
}
.sense.on {
  border-color: var(--ink);
}
.index {
  flex: none;
  font-weight: 900;
  color: var(--muted);
}
.tag {
  flex: none;
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--muted);
}
</style>
