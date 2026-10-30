/* Lab entry: experimental games, played locally, never calling our Worker. */
import { createApp, h } from 'vue';
import { createRouter, createWebHistory, RouterView, useRoute } from 'vue-router';
import '../src/style.css';
import '../src/ui.css';
import LabHomeView from './LabHomeView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LabHomeView },
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
