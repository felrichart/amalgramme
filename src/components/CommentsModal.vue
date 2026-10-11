<script setup>
/* A solved level's comments, plus the player's own single, final comment. */
import { ref, computed, onMounted } from 'vue';
import { COMMENT_MAX_LENGTH } from '../../shared/constants.js';
import { username, isAdmin } from '../composables/useAccount.js';
import { fetchComments, postComment, deleteComment } from '../services/comments.js';
import { useRequest } from '../composables/useRequest.js';
import BaseModal from './ui/BaseModal.vue';

const props = defineProps({ date: { type: String, required: true } });
const emit = defineEmits(['close', 'count']);

const comments = ref(null);
const draft = ref('');
const { busy, error, run } = useRequest((fn, ...args) => fn(...args));

const mine = computed(() => comments.value?.some((c) => c.username === username.value));
const left = computed(() => COMMENT_MAX_LENGTH - draft.value.length);
const canPost = computed(() => !!draft.value.trim() && left.value >= 0 && !busy.value);

function setComments(list) {
  comments.value = list;
  emit('count', list.length);
}

onMounted(async () => {
  const res = await run(fetchComments, props.date);
  if (res.ok) setComments(res.data);
});

async function publish() {
  if (!canPost.value) return;
  const res = await run(postComment, props.date, draft.value.trim());
  if (res.ok) {
    draft.value = '';
    setComments([res.data, ...comments.value]);
  }
}

async function remove(c) {
  const res = await run(deleteComment, props.date, c.username);
  if (res.ok) setComments(comments.value.filter((x) => x !== c));
}

const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
</script>

<template>
  <BaseModal label="Commentaires" class="comments" @close="emit('close')">
    <h2 class="modal-title">Commentaires</h2>

    <template v-if="comments">
      <div v-if="!mine" class="compose">
        <textarea
          v-model="draft"
          class="field"
          rows="3"
          :maxlength="COMMENT_MAX_LENGTH"
          placeholder="Ton avis sur ce niveau…"
        />
        <div class="compose-foot">
          <span class="fine">Un seul commentaire par niveau, définitif.</span>
          <span class="fine" :class="{ over: left < 20 }">{{ left }}</span>
        </div>
        <button class="cta press" type="button" :disabled="!canPost" @click="publish">
          {{ busy ? '…' : 'Publier' }}
        </button>
      </div>

      <ul class="thread">
        <li v-for="c in comments" :key="c.username" class="item">
          <div class="item-head">
            <strong>{{ c.username }}</strong>
            <span class="fine">{{ DAY.format(c.created_at) }}</span>
            <button
              v-if="isAdmin"
              class="del"
              type="button"
              :aria-label="`Supprimer le commentaire de ${c.username}`"
              @click="remove(c)"
            >
              ✕
            </button>
          </div>
          <p class="text">{{ c.body }}</p>
        </li>
        <li v-if="!comments.length" class="fine empty">Aucun commentaire. Lance-toi !</li>
      </ul>
    </template>
    <p v-else-if="busy" class="fine empty">Chargement…</p>

    <p v-if="error" class="err">{{ error }}</p>
    <button class="cta ghost press" type="button" @click="emit('close')">Fermer</button>
  </BaseModal>
</template>

<style scoped>
.comments {
  max-height: min(85dvh, 640px);
}
.compose {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.field {
  width: 100%;
  resize: none;
  padding: 0.7rem 0.85rem;
  font: inherit;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--ink);
  background: var(--tile);
  border-radius: 0.9rem;
}
.field:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.compose-foot {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
.fine {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--muted);
}
.over {
  color: var(--danger);
}
.thread {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  overflow-y: auto;
  min-height: 0;
}
.item {
  padding: 0.6rem 0.8rem;
  border-radius: 0.9rem;
  background: var(--tile);
}
.item-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.del {
  margin-left: auto;
  border: none;
  background: none;
  font: inherit;
  font-weight: 900;
  color: var(--danger);
  cursor: pointer;
}
.text {
  margin: 0.2rem 0 0;
  font-weight: 600;
  line-height: 1.35;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.empty {
  text-align: center;
}
</style>
