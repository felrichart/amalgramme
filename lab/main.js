/* Lab entry: experimental games, played locally, never calling our Worker. */
import { createApp, h } from 'vue';
import { createRouter, createWebHistory, RouterView, useRoute } from 'vue-router';
import '../src/style.css';
import '../src/ui.css';
import LabHomeView from './LabHomeView.vue';
import LexGameView from './lexilouhette/LexGameView.vue';
import LexAllView from './lexilouhette/LexAllView.vue';
import { levelByPattern } from './lexilouhette/levels.js';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LabHomeView },
    { path: '/lexilouhette', component: LexAllView },
    {
      path: '/lexilouhette/:pattern',
      component: LexGameView,
      beforeEnter: (to) => !!levelByPattern(to.params.pattern) || '/lexilouhette',
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
