import {
  isCommunityId,
  communityRecord,
  authorPosition,
  COMMUNITY_PREFIX,
} from '../data/community.js';
import { todayDate, olderDate } from '../data/dailies.js';
import { dateForSlug, puzzleForDate, slugForDate } from '../data/levels.js';
import { formatChallengeDate } from '../utils/format.js';

/* Where a level sits: its title, back link and the finish-screen actions. */
function levelMeta(date, today) {
  if (isCommunityId(date)) {
    const rec = communityRecord(date);
    const { number, next } = authorPosition(rec);
    const list = `/community/${rec.author}`;
    return {
      title: `Défi de ${rec.author}${number ? ` #${number}` : ''}`,
      back: list,
      actions: [
        next && {
          label: 'Prochain défi',
          to: `/play/${COMMUNITY_PREFIX}${next.id}`,
          variant: 'violet',
        },
        { label: 'Liste', to: list, variant: 'ghost' },
      ],
    };
  }
  if (date === today) {
    return {
      title: 'Défi quotidien',
      back: '/',
      actions: [
        { label: 'Défis passés', to: '/challenges', variant: 'wash' },
        { label: 'Retour au menu', to: '/', variant: 'ghost' },
      ],
    };
  }
  const older = olderDate(date);
  return {
    title: formatChallengeDate(date),
    back: '/challenges',
    actions: [
      older && { label: 'Prochain défi', to: `/play/${slugForDate(older)}` },
      { label: 'Liste des défis', to: '/challenges', variant: 'ghost' },
    ],
  };
}

/*
 * Resolve a /play slug to a playable date plus its meta. An unknown slug redirects
 * to its list, a future daily to today's; either way the date falls back to today
 * so the about-to-be-replaced render stays valid.
 */
export function useLevel(slug, router) {
  const today = todayDate();
  const requested = dateForSlug(slug);
  const known = !!puzzleForDate(requested);
  const playable = known && (isCommunityId(requested) || requested <= today);
  if (!known) router.replace(isCommunityId(requested) ? '/community' : '/');
  else if (!playable) router.replace('/play/daily');
  const date = playable ? requested : today;
  const meta = levelMeta(date, today);
  return { date, ...meta, actions: meta.actions.filter(Boolean) };
}
