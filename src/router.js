import { createRouter, createWebHistory } from 'vue-router';
import { isAdmin } from './composables/useUsername.js';
import MenuView from './views/MenuView.vue';
import ChallengesView from './views/ChallengesView.vue';
import CommunityView from './views/CommunityView.vue';
import CommunityAuthorView from './views/CommunityAuthorView.vue';
import CreateChallengeView from './views/CreateChallengeView.vue';
import AdminView from './views/AdminView.vue';
import AdminDailyEditView from './views/AdminDailyEditView.vue';
import GameView from './views/GameView.vue';

// Casual gate: the Worker enforces admin rights on every write.
const adminOnly = () => isAdmin.value || '/';

const routes = [
  { path: '/', component: MenuView },
  { path: '/challenges', component: ChallengesView },
  { path: '/community', component: CommunityView },
  { path: '/community/create', component: CreateChallengeView },
  { path: '/community/:author', component: CommunityAuthorView },
  { path: '/admin', component: AdminView, beforeEnter: adminOnly },
  { path: '/admin/new', component: AdminDailyEditView, beforeEnter: adminOnly },
  { path: '/admin/edit/:date', component: AdminDailyEditView, beforeEnter: adminOnly },
  { path: '/play/:slug', component: GameView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
