import { createRouter, createWebHistory } from 'vue-router';
import LevelsView from './views/LevelsView.vue';
import GameView from './views/GameView.vue';

const routes = [
  { path: '/', component: LevelsView },
  { path: '/play/:level', component: GameView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
