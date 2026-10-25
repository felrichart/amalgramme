/* Lab entry: experimental games, played locally, never calling our Worker. */
import { createApp, h } from 'vue';
import { createRouter, createWebHistory, RouterView, useRoute } from 'vue-router';
import '../src/style.css';
import '../src/ui.css';
import './lexilouhette/lex.css';
import LabHomeView from './LabHomeView.vue';
import LexGameView from './lexilouhette/LexGameView.vue';
import LexAllView from './lexilouhette/LexAllView.vue';
import LexEditView from './lexilouhette/LexEditView.vue';
import { bankLevel, playableLevel } from './lexilouhette/levels.js';
import { isAdmin, loadOfficial, officialLevel } from './lexilouhette/official.js';

const adminOnly = () => isAdmin || '/lexilouhette';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LabHomeView },
    { path: '/lexilouhette', component: LexAllView, props: { source: 'official' } },
    {
      path: '/lexilouhette/banque',
      component: LexAllView,
      props: { source: 'bank' },
      beforeEnter: adminOnly,
    },
    {
      path: '/lexilouhette/banque/:pattern',
      component: LexGameView,
      props: { source: 'bank' },
      beforeEnter: (to) => (isAdmin && !!bankLevel(to.params.pattern)) || '/lexilouhette',
    },
    {
      path: '/lexilouhette/editer/:pattern',
      component: LexEditView,
      beforeEnter: (to) => {
        const { pattern } = to.params;
        return (isAdmin && !!(officialLevel(pattern) || bankLevel(pattern))) || '/lexilouhette';
      },
    },
    {
      path: '/lexilouhette/:pattern',
      component: LexGameView,
      props: { source: 'official' },
      beforeEnter: (to) => !!playableLevel(to.params.pattern) || '/lexilouhette',
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

loadOfficial().then(() => createApp(App).use(router).mount('#app'));
