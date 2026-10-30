/*
 * Dicorama's routes, under /dicorama. Its views load on demand, so Amalgramme's
 * players don't fetch them. Players have a day's level (/dicorama goes to the
 * latest day's) and the list of the days played. The bank, the editor, the
 * levels to come and drafts are the admin's: a casual gate, the Worker enforces
 * it on every write.
 */
import { isAdmin } from '../composables/useAccount.js';
import { loadOfficial, officialLevel, playedLevels } from './store.js';
import { loadBank, levelFor } from './levels.js';

const HOME = '/dicorama';
const Game = () => import('./views/DicoGameView.vue');

const adminOnly = () => isAdmin.value || HOME;
// Waits for the levels (the device's copy when offline), then checks the level.
const playable = (source, param) => async (to) => {
  await Promise.all([loadOfficial(), loadBank()]);
  return !!levelFor(source, to.params[param]) || HOME;
};

/* A day played, else the latest one (none yet: the screen says so). */
async function playedDay(to) {
  await loadOfficial();
  const days = playedLevels();
  if (days.some((l) => l.date === to.params.date)) return true;
  const latest = days.at(-1)?.date;
  return latest && to.params.date !== latest ? `${HOME}/${latest}` : true;
}

export default [
  {
    path: '/dicorama/:date(\\d{4}-\\d{2}-\\d{2})?',
    component: () => import('./views/DicoDaysView.vue'),
    beforeEnter: playedDay,
  },
  {
    path: '/dicorama/jours',
    component: () => import('./views/DicoPastView.vue'),
    beforeEnter: () => loadOfficial().then(() => true),
  },
  {
    path: '/dicorama/a-venir',
    component: () => import('./views/DicoUpcomingView.vue'),
    beforeEnter: [adminOnly, () => loadOfficial().then(() => true)],
  },
  {
    path: '/dicorama/banque',
    component: () => import('./views/DicoBankView.vue'),
    beforeEnter: [adminOnly, () => loadBank().then(() => true)],
  },
  {
    path: '/dicorama/banque/:pattern',
    component: Game,
    props: { source: 'bank' },
    beforeEnter: [adminOnly, playable('bank', 'pattern')],
  },
  {
    path: '/dicorama/motif/:pattern',
    component: Game,
    props: { source: 'official' },
    beforeEnter: [adminOnly, playable('official', 'pattern')],
  },
  {
    path: '/dicorama/editer/:pattern',
    component: () => import('./views/DicoEditView.vue'),
    beforeEnter: [
      adminOnly,
      async (to) => {
        await Promise.all([loadOfficial(), loadBank()]);
        const { pattern } = to.params;
        return !!(officialLevel(pattern) || levelFor('bank', pattern)) || HOME;
      },
    ],
  },
  { path: '/dicorama/:rest(.*)', redirect: HOME },
];
