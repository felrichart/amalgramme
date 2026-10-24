/* Lab entry: experimental games, played locally, with no server calls. */
import { createApp, h } from 'vue';
import { createRouter, createWebHistory, RouterView, useRoute } from 'vue-router';
import '../src/style.css';
import '../src/ui.css';
import LabHomeView from './LabHomeView.vue';
import LexMenuView from './lexilouhette/LexMenuView.vue';
import LexGameView from './lexilouhette/LexGameView.vue';
import LexAllView from './lexilouhette/LexAllView.vue';
import { levelByDate, levelByPattern } from './lexilouhette/levels.js';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LabHomeView },
    { path: '/lexilouhette', component: LexMenuView },
    { path: '/lexilouhette/tous', component: LexAllView },
    {
      path: '/lexilouhette/motif/:pattern',
      component: LexGameView,
      beforeEnter: (to) => !!levelByPattern(to.params.pattern) || '/lexilouhette/tous',
    },
    {
      path: '/lexilouhette/:date',
      component: LexGameView,
      beforeEnter: (to) => !!levelByDate(to.params.date) || '/lexilouhette',
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// Views read their level once at setup: remount on every route change.
const App = {
  setup() {
    const route = useRoute();
    return () => h(RouterView, { key: route.fullPath });
  },
};

createApp(App).use(router).mount('#app');
