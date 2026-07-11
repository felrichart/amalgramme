import { createApp } from 'vue';
import './style.css';
import { resolveToday } from './utils/today.js';

/* Resolve today's date (API + device timezone) before loading App/router, so
 * challenges.js computes DAILY_INDEX from the resolved date. App and router are
 * imported dynamically for that ordering to hold. No device-clock fallback: if
 * the time API fails, abort load and show an error instead of mounting. */
resolveToday()
  .then(async () => {
    const { default: App } = await import('./App.vue');
    const { default: router } = await import('./router.js');
    createApp(App).use(router).mount('#app');
  })
  .catch((err) => {
    const el = document.getElementById('app');
    if (el) el.textContent = 'Impossible de récupérer la date. Vérifiez votre connexion et rechargez.';
    throw err;
  });
