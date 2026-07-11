import { createRouter, createWebHistory } from 'vue-router';
import MenuView from './views/MenuView.vue';
import ChallengesView from './views/ChallengesView.vue';
import GameView from './views/GameView.vue';

const routes = [
  { path: '/', component: MenuView },
  { path: '/challenges', component: ChallengesView },
  { path: '/play/:slug', component: GameView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
