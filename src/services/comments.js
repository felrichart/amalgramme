/* Level comments: readable and postable once the signed-in player solved the level. */
import { mutate } from './api.js';
import { syncSave } from './sync.js';

const MESSAGES = {
  not_solved: 'Termine ce niveau pour voir les commentaires.',
  already_commented: 'Tu as déjà commenté ce niveau.',
  bad_comment: 'Commentaire vide ou trop long.',
  rate_limited: 'Trop de commentaires en ce moment, réessaie dans un instant.',
};

const path = (date) => `/comments/${encodeURIComponent(date)}`;

/* Syncs the level's save first: the Worker checks the solve on the account. */
export async function fetchComments(date) {
  await syncSave(date);
  return mutate(path(date), {
    method: 'GET',
    messages: MESSAGES,
    fallback: 'Chargement impossible.',
  });
}

export const postComment = (date, body) =>
  mutate(path(date), { body: { body }, messages: MESSAGES, fallback: 'Publication refusée.' });

export const deleteComment = (date, username) =>
  mutate(`${path(date)}/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    body: {},
    fallback: 'Suppression refusée.',
  });
