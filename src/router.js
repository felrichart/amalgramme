import { createRouter, createWebHistory } from 'vue-router';
import MenuView from './views/MenuView.vue';
import ChallengesView from './views/ChallengesView.vue';
import CommunityView from './views/CommunityView.vue';
import CommunityAuthorView from './views/CommunityAuthorView.vue';
import CreateChallengeView from './views/CreateChallengeView.vue';
import GameView from './views/GameView.vue';

const routes = [
  { path: '/', component: MenuView },
  { path: '/challenges', component: ChallengesView },
  { path: '/community', component: CommunityView },
  { path: '/community/create', component: CreateChallengeView },
  { path: '/community/edit/:id', component: CreateChallengeView },
  { path: '/community/:author', component: CommunityAuthorView },
  { path: '/play/:slug', component: GameView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
