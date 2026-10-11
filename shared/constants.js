/*
 * Identity and id constants shared by the client and the Cloudflare Worker
 * (server/worker.js), so both enforce the same rules.
 *
 * Pure and dependency-free: it must bundle for the browser (Vite) and the Worker
 * (esbuild) alike. Editing anything here changes server-side behaviour too, so
 * redeploy the Worker afterwards (`wrangler deploy` from server/, see server/README.md).
 */

/* The one privileged username: once its PIN checks out it may manage dailies and
 * delete any community level. Casual moderation, not real auth. */
export const ADMIN_NAME = 'cara+';

/* A PIN is exactly 4 digits — a casual ownership check, not a password. */
export const PIN_RE = /^\d{4}$/;

export function pinValid(pin) {
  return PIN_RE.test(pin ?? '');
}

export const NAME_MAX_LENGTH = 20;

/* A community level id is the first 8 chars of a server-minted UUID: compact
 * routes and save keys, negligible collision risk at this scale. */
export const LEVEL_ID_LENGTH = 8;
