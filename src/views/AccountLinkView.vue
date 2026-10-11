<script setup>
/* Landing page for an emailed link: confirm the email (`verify`) or choose a new
 * password (`reset`). The token rides in `?token=`. */
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { passwordValid, PASSWORD_MIN_LENGTH } from '../../shared/constants.js';
import { verifyEmail, resetPassword } from '../services/account.js';
import { useRequest } from '../composables/useRequest.js';
import PageHeader from '../components/ui/PageHeader.vue';

const props = defineProps({ kind: { type: String, required: true } });

const route = useRoute();
const router = useRouter();
const token = String(route.query.token ?? '');

const done = ref(false);
const password = ref('');
const { busy, error, run } = useRequest((fn, arg) => fn(arg));

onMounted(async () => {
  if (props.kind !== 'verify') return;
  if (!token) error.value = 'Lien incomplet.';
  else done.value = (await run(verifyEmail, token)).ok;
});

const valid = computed(() => !!token && passwordValid(password.value));

async function submit() {
  if (busy.value || !valid.value) return;
  done.value = (await run(resetPassword, { token, password: password.value })).ok;
}
</script>

<template>
  <div class="page fit">
    <PageHeader
      :title="kind === 'verify' ? 'Confirmation' : 'Nouveau mot de passe'"
      back="/"
      back-label="menu"
    />
    <main class="box">
      <template v-if="kind === 'verify'">
        <p v-if="busy" class="msg">Vérification…</p>
        <p v-else-if="done" class="msg">Adresse confirmée, merci !</p>
      </template>
      <template v-else-if="done">
        <p class="msg">Mot de passe changé, tu es connecté.</p>
      </template>
      <template v-else>
        <input
          v-model="password"
          class="field"
          type="password"
          autocomplete="new-password"
          :placeholder="`Nouveau mot de passe (${PASSWORD_MIN_LENGTH} caractères min.)`"
          @keydown.enter="submit"
        />
        <button class="cta press" type="button" :disabled="!valid || busy" @click="submit">
          {{ busy ? '…' : 'Valider' }}
        </button>
      </template>
      <p v-if="error" class="err">{{ error }}</p>
      <button v-if="done || error" class="cta ghost press" type="button" @click="router.push('/')">
        Retour au menu
      </button>
    </main>
  </div>
</template>

<style scoped>
.box {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  width: 100%;
  max-width: 360px;
  margin: 1.5rem auto;
  padding: 0 1rem;
}
.msg {
  margin: 0;
  text-align: center;
  font-weight: 800;
  font-size: 1.05rem;
}
.field {
  width: 100%;
  padding: 0.85rem 1rem;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 900;
  color: var(--ink);
  background: var(--tile);
  border-radius: 0.9rem;
}
</style>
