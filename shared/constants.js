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

/* A PIN is exactly 4 digits: the legacy sign-in, accepted until PIN_DEADLINE. */
export const PIN_RE = /^\d{4}$/;

/* After this instant PIN-only accounts can't sign in and are deleted (their
 * community levels stay). Owners must add an email + password before then. */
export const PIN_DEADLINE = Date.parse('2027-01-11T00:00:00+01:00');

export function pinValid(pin) {
  return PIN_RE.test(pin ?? '');
}

export const NAME_MAX_LENGTH = 20;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordValid(pw) {
  return (
    typeof pw === 'string' && pw.length >= PASSWORD_MIN_LENGTH && pw.length <= PASSWORD_MAX_LENGTH
  );
}

/* Deliberately loose: the verification email is the real check. */
export function emailValid(email) {
  return (
    typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

/* A community level id is the first 8 chars of a server-minted UUID: compact
 * routes and save keys, negligible collision risk at this scale. */
export const LEVEL_ID_LENGTH = 8;

export const COMMENT_MAX_LENGTH = 280;
