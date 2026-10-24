<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const GAMES = [
  {
    path: '/lexilouhette',
    name: 'Lexilouhette',
    pitch: 'Trouve tous les mots qui épousent la silhouette.',
    tint: 'var(--violet)',
  },
];
</script>

<template>
  <div class="page fit">
    <header class="top">
      <h1 class="title">Labo</h1>
      <p class="sub">Jeux en test, en local uniquement.</p>
    </header>
    <ul class="list">
      <li v-for="game in GAMES" :key="game.path">
        <button
          class="row press"
          :style="{ '--tint': game.tint }"
          type="button"
          @click="router.push(game.path)"
        >
          <span class="label">
            <span>{{ game.name }}</span>
            <span class="pitch">{{ game.pitch }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.top {
  padding: 1.6rem 1rem 0.6rem;
  text-align: center;
}
.title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 900;
}
.sub {
  color: var(--muted);
  font-weight: 700;
}
.label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.pitch {
  font-size: 0.85rem;
  font-weight: 700;
  opacity: 0.8;
}
</style>
