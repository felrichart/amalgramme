<script setup>
/*
 * Account dialog. Signed out: sign in (name or email + password), sign up, the
 * legacy PIN sign-in, or a password-reset request. Signed in: the profile, plus
 * whatever the account still needs — securing a PIN account before its
 * deadline, or confirming the email.
 */
import { ref, reactive, computed, watch, nextTick } from 'vue';
import {
  pinValid,
  passwordValid,
  emailValid,
  PASSWORD_MIN_LENGTH,
} from '../../shared/constants.js';
import { user, connected, needsSecuring, needsVerification } from '../composables/useAccount.js';
import {
  login,
  signup,
  loginPin,
  logout,
  secureAccount,
  resendVerification,
  forgotPassword,
  refreshUser,
} from '../services/account.js';
import { useRequest } from '../composables/useRequest.js';
import { formatLongDate } from '../utils/format.js';
import BaseModal from './ui/BaseModal.vue';

const props = defineProps({ open: Boolean });
const emit = defineEmits(['close', 'saved', 'logout']);

/* 'connexion' | 'inscription' | 'pin' | 'oubli' while signed out. */
const mode = ref('connexion');
const form = reactive({ name: '', email: '', password: '' });
const pin = ref(['', '', '', '']);
const pinBoxes = [];
const firstInput = ref(null);
const info = ref('');

const { busy, error, run } = useRequest((fn, ...args) => fn(...args));

function go(next) {
  mode.value = next;
  error.value = '';
  info.value = '';
  form.password = '';
  pin.value = ['', '', '', ''];
  nextTick(() => firstInput.value?.focus());
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    Object.assign(form, { name: '', email: '', password: '' });
    if (connected.value) {
      info.value = '';
      error.value = '';
      refreshUser();
    } else go('connexion');
  },
);

const deadline = computed(() =>
  user.value?.pinDeadline ? formatLongDate(new Date(user.value.pinDeadline)) : '',
);
const daysLeft = computed(() =>
  Math.max(0, Math.ceil((user.value?.pinDeadline - Date.now()) / 86_400_000)),
);

const valid = computed(() => {
  const name = form.name.trim();
  switch (mode.value) {
    case 'connexion':
      return !!name && !!form.password;
    case 'inscription':
      return !!name && emailValid(form.email.trim()) && passwordValid(form.password);
    case 'pin':
      return !!name && pinValid(pin.value.join(''));
    case 'oubli':
      return !!name;
  }
  return false;
});
const secureValid = computed(() => emailValid(form.email.trim()) && passwordValid(form.password));

async function submit() {
  if (busy.value || !valid.value) return;
  const name = form.name.trim();
  if (mode.value === 'oubli') {
    const res = await run(forgotPassword, name);
    if (res.ok) info.value = 'Si un compte correspond, un email de réinitialisation est parti.';
    return;
  }
  const res =
    mode.value === 'connexion'
      ? await run(login, { login: name, password: form.password })
      : mode.value === 'inscription'
        ? await run(signup, { username: name, email: form.email.trim(), password: form.password })
        : await run(loginPin, { username: name, pin: pin.value.join('') });
  if (!res.ok) return;
  emit('saved', user.value.username);
  // A PIN sign-in stays open on the "secure your account" step.
  if (mode.value !== 'pin') emit('close');
}

async function secure() {
  if (busy.value || !secureValid.value) return;
  const res = await run(secureAccount, { email: form.email.trim(), password: form.password });
  if (res.ok) {
    form.password = '';
    info.value = 'Compte sécurisé ! Un email de confirmation vient de partir.';
  }
}

async function resend() {
  const res = await run(resendVerification);
  if (res.ok) info.value = `Email renvoyé à ${user.value.email}.`;
}

async function signOut() {
  await logout();
  emit('logout');
  emit('close');
}

/* One digit per box; typing advances, deleting an empty box goes back. */
function onDigit(i, e) {
  const d = e.target.value.replace(/\D/g, '').slice(-1);
  pin.value[i] = d;
  e.target.value = d;
  if (d && i < 3) pinBoxes[i + 1]?.focus();
}
function onPinKey(i, e) {
  if (e.key === 'Backspace' && !pin.value[i] && i > 0) pinBoxes[i - 1]?.focus();
  else if (e.key === 'Enter') submit();
}

const SUBMIT = {
  connexion: 'Se connecter',
  inscription: "S'inscrire",
  pin: 'Se connecter',
  oubli: 'Envoyer le lien',
};
</script>

<template>
  <BaseModal v-if="open" label="Compte joueur" :locked="busy" @close="emit('close')">
    <template v-if="connected">
      <h2 class="modal-title">Mon compte</h2>
      <p class="who">
        <strong>{{ user.username }}</strong>
        <span v-if="user.email" class="mail">{{ user.email }}</span>
      </p>

      <section v-if="needsSecuring" class="alert" aria-live="polite">
        <p class="alert-title">⚠️ Action requise</p>
        <p>
          Ton compte n’est protégé que par un code PIN à 4 chiffres. Ajoute un email et un mot de
          passe avant le <strong>{{ deadline }}</strong> ({{ daysLeft }} jours) : passé cette date,
          le compte sera supprimé et ton nom libéré. Tes défis publiés resteront en ligne.
        </p>
      </section>
      <template v-if="needsSecuring">
        <input
          v-model="form.email"
          class="field"
          type="email"
          autocomplete="email"
          placeholder="Adresse email"
        />
        <input
          v-model="form.password"
          class="field"
          type="password"
          autocomplete="new-password"
          :placeholder="`Mot de passe (${PASSWORD_MIN_LENGTH} caractères min.)`"
          @keydown.enter="secure"
        />
        <button class="cta press" type="button" :disabled="!secureValid || busy" @click="secure">
          {{ busy ? '…' : 'Sécuriser mon compte' }}
        </button>
      </template>

      <section v-else-if="needsVerification" class="alert soft">
        <p>
          Confirme ton adresse avec le lien envoyé à <strong>{{ user.email }}</strong> : elle
          servira à récupérer ton compte si tu oublies ton mot de passe.
        </p>
        <button class="linkish" type="button" :disabled="busy" @click="resend">
          Renvoyer l’email
        </button>
      </section>

      <p v-if="info" class="ok">{{ info }}</p>
      <p v-if="error" class="err">{{ error }}</p>
      <button class="cta danger press" type="button" :disabled="busy" @click="signOut">
        Déconnexion
      </button>
    </template>

    <template v-else>
      <div v-if="mode === 'connexion' || mode === 'inscription'" class="tabs" role="tablist">
        <button
          v-for="m in ['connexion', 'inscription']"
          :key="m"
          class="tab"
          :class="{ on: mode === m }"
          type="button"
          role="tab"
          :aria-selected="mode === m"
          @click="go(m)"
        >
          {{ m === 'connexion' ? 'Connexion' : 'Inscription' }}
        </button>
      </div>
      <h2 v-else class="modal-title">
        {{ mode === 'pin' ? 'Ancien compte (code PIN)' : 'Mot de passe oublié' }}
      </h2>

      <p v-if="mode === 'pin'" class="note">
        Les codes PIN sont remplacés par des mots de passe. Connecte-toi une dernière fois avec ton
        code pour sécuriser ton compte.
      </p>

      <input
        ref="firstInput"
        v-model="form.name"
        class="field"
        type="text"
        :maxlength="mode === 'connexion' || mode === 'oubli' ? 254 : 20"
        :autocomplete="mode === 'inscription' ? 'username' : 'username email'"
        :placeholder="mode === 'connexion' || mode === 'oubli' ? 'Nom ou email' : 'Ton nom'"
        @keydown.enter="submit"
      />
      <input
        v-if="mode === 'inscription'"
        v-model="form.email"
        class="field"
        type="email"
        autocomplete="email"
        placeholder="Adresse email"
        @keydown.enter="submit"
      />
      <input
        v-if="mode === 'connexion' || mode === 'inscription'"
        v-model="form.password"
        class="field"
        type="password"
        :autocomplete="mode === 'inscription' ? 'new-password' : 'current-password'"
        :placeholder="
          mode === 'inscription'
            ? `Mot de passe (${PASSWORD_MIN_LENGTH} caractères min.)`
            : 'Mot de passe'
        "
        @keydown.enter="submit"
      />
      <div v-if="mode === 'pin'" class="pin" role="group" aria-label="Code PIN à 4 chiffres">
        <input
          v-for="(d, i) in pin"
          :key="i"
          :ref="(el) => (pinBoxes[i] = el)"
          class="field digit"
          type="password"
          inputmode="numeric"
          maxlength="1"
          :value="d"
          @input="onDigit(i, $event)"
          @keydown="onPinKey(i, $event)"
        />
      </div>

      <p v-if="info" class="ok">{{ info }}</p>
      <p v-if="error" class="err">{{ error }}</p>
      <button class="cta press" type="button" :disabled="!valid || busy" @click="submit">
        {{ busy ? '…' : SUBMIT[mode] }}
      </button>

      <div class="links">
        <template v-if="mode === 'connexion'">
          <button class="linkish" type="button" @click="go('oubli')">Mot de passe oublié ?</button>
          <button class="linkish" type="button" @click="go('pin')">
            Ancien compte avec code PIN ?
          </button>
        </template>
        <button
          v-else-if="mode !== 'inscription'"
          class="linkish"
          type="button"
          @click="go('connexion')"
        >
          ← Retour
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.who {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  margin: 0;
  color: var(--ink);
}
.mail {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.alert {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.8rem 0.9rem;
  border: var(--outline-w) solid var(--danger);
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--danger) 12%, var(--panel));
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--ink);
}
.alert.soft {
  border-color: var(--accent);
  background: var(--accent-wash);
}
.alert p {
  margin: 0;
}
.alert-title {
  font-weight: 900;
  font-size: 0.95rem;
  color: var(--danger);
}
.note {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--muted);
  text-align: center;
}
.ok {
  margin: 0;
  text-align: center;
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--ink);
}
.tabs {
  display: flex;
  gap: 0.5rem;
}
.tab,
.field {
  font-family: inherit;
  font-weight: 900;
  color: var(--ink);
  background: var(--tile);
  border-radius: 0.9rem;
}
.tab {
  flex: 1;
  padding: 0.7rem 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  color: var(--muted);
  border: var(--outline-w) solid var(--outline);
  box-shadow: var(--lift-sm);
}
.tab.on {
  color: var(--on-color);
  background: var(--accent);
}
.tab:focus-visible,
.field:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.field {
  width: 100%;
  padding: 0.85rem 1rem;
  font-size: 1.05rem;
}
.pin {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
}
.digit {
  width: 3.2rem;
  height: 3.2rem;
  padding: 0;
  text-align: center;
  font-size: 1.5rem;
  border-radius: 0.8rem;
}
.links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}
.linkish {
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--muted);
  background: none;
  border: none;
  padding: 0.2rem;
  text-decoration: underline;
  cursor: pointer;
}
</style>
