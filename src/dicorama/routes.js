/*
 * Dicorama's routes, under /dicorama. Its views load on demand, so Amalgramme's
 * players don't fetch them. The bank, the editor and drafts are the admin's:
 * a casual gate, the Worker enforces it on every write.
 */
import { isAdmin } from '../composables/useAccount.js';
import { loadOfficial, officialLevel } from './store.js';
import { loadBank, levelFor } from './levels.js';

const HOME = '/dicorama';
const Game = () => import('./views/DicoGameView.vue');

const adminOnly = () => isAdmin.value || HOME;
// Waits for the levels (the device's copy when offline), then checks the level.
const playable = (source, param) => async (to) => {
  await (source === 'day' ? loadOfficial() : Promise.all([loadOfficial(), loadBank()]));
  return !!levelFor(source, to.params[param]) || HOME;
};

export default [
  {
    path: '/dicorama',
    component: () => import('./views/DicoHomeView.vue'),
    beforeEnter: () => loadOfficial().then(() => true),
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
  {
    path: '/dicorama/:date(\\d{4}-\\d{2}-\\d{2})',
    component: Game,
    props: { source: 'day' },
    beforeEnter: playable('day', 'date'),
  },
  { path: '/dicorama/:rest(.*)', redirect: HOME },
];
