/*
 * Amalgramme community-levels API — a single Cloudflare Worker over D1.
 *   POST   /auth          sign in (verify name+PIN) or sign up (claim a name)
 *   GET    /levels        list every level, newest first (never returns PINs)
 *   POST   /levels        create one (claims/verifies the author via name+PIN,
 *                         globally rate-limited, validated)
 *   DELETE /levels/:id     remove one (author+PIN). Community levels are
 *                         create-only — there is no edit endpoint.
 *   POST   /levels/:id/attempt  record a play by an anonymous client (no sign-in)
 *   POST   /levels/:id/solve    record a completion by an anonymous client
 *   GET    /dailies         list every daily (with play stats), oldest first
 *   POST   /dailies         create one (admin only, date must be today or later)
 *   PUT    /dailies/:date    edit one (admin only, today or later)
 *   DELETE /dailies/:date    remove one (admin only, today or later)
 *   POST   /dailies/:date/attempt|solve  record an anonymous play, like /levels
 *   POST   /admin/export    full DB dump for the admin's manual backup
 *
 * Identity: a username is claimed by a PIN on first use and stored in `users`
 * (plaintext, by design — a casual ownership check, not a password). Reusing a
 * name later requires the same PIN. The reserved name `cara+` may edit/delete
 * any level once its PIN checks out. Word rules are shared verbatim with the
 * client via ../shared/word-rules.js.
 */
import { normalizeWord, wordError, canBuildSecret } from '../shared/word-rules.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

/* The one privileged username: once its PIN checks out it may edit/delete any
 * level, not just its own. Casual moderation, not real auth (kept in sync with
 * src/composables/useUsername.js). */
const ADMIN_NAME = 'cara+';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

const PIN_RE = /^\d{4}$/;

/* A community level id: the first 8 chars of a UUID. Short enough to keep routes
 * and localStorage save keys compact; collision risk is negligible at this scale
 * (must stay in sync with COMMUNITY_ID_LENGTH in src/data/community.js). */
function newLevelId() {
  return crypto.randomUUID().slice(0, 8);
}

/* A well-formed challenge payload → normalised {words, secret}, or null. */
function parseChallenge(body) {
  const words = Array.isArray(body.words) ? body.words.map(normalizeWord) : [];
  const secret = normalizeWord(body.secret);
  const valid =
    words.length === 4 &&
    !words.some((w) => wordError(w)) &&
    new Set(words).size === words.length &&
    !wordError(secret) &&
    canBuildSecret(secret, words);
  return valid ? { words, secret } : null;
}

/*
 * Verify (and optionally claim) an author's PIN. Returns:
 *   'ok'        name+PIN check out (created it when `create` and new)
 *   'no_pin'    malformed name or PIN
 *   'mismatch'  name exists with a different PIN, or (when !create) is unknown
 */
async function authAuthor(env, name, pin, create) {
  if (!name || !PIN_RE.test(pin)) return 'no_pin';
  const row = await env.DB.prepare('SELECT pin FROM users WHERE username = ?').bind(name).first();
  if (row) return row.pin === pin ? 'ok' : 'mismatch';
  if (!create) return 'mismatch';
  await env.DB.prepare('INSERT INTO users (username, pin, created_at) VALUES (?, ?, ?)')
    .bind(name, pin, Date.now())
    .run();
  return 'ok';
}

/* Server-authoritative "today" (YYYY-MM-DD) in Europe/Paris — the boundary for
 * the daily today-and-future edit guard. `en-CA` formats a Date as ISO. */
function serverToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

/* Authorise the admin (cara+) for a privileged daily/backup action. Returns an
 * error code ('no_pin' | 'forbidden') or null when the caller is the admin with
 * a valid PIN. */
async function requireAdmin(env, body) {
  const author = String(body.author ?? '').trim();
  const auth = await authAuthor(env, author, String(body.pin ?? ''), false);
  if (auth === 'no_pin') return 'no_pin';
  if (auth !== 'ok' || author !== ADMIN_NAME) return 'forbidden';
  return null;
}

/* Upsert one anonymous play into level_stats. `id` is a community level id or a
 * daily's ISO date; `kind` is 'attempt' (solved stays/inserts 0) or 'solve'
 * (upserts to 1). Deduped by the (level, client) primary key. */
async function recordPlay(env, id, kind, client) {
  const solved = kind === 'solve' ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO level_stats (level_id, client_id, solved, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(level_id, client_id)
     DO UPDATE SET solved = MAX(solved, excluded.solved), updated_at = excluded.updated_at`,
  )
    .bind(id, client, solved, Date.now())
    .run();
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    /* Sign in / sign up: verify (connexion) or claim (inscription) a name+PIN,
     * so the client can refuse a wrong code or an unknown name up front. */
    if (pathname === '/auth' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'bad_json' }, 400);
      }
      const author = String(body.author ?? '')
        .trim()
        .slice(0, 20);
      const pin = String(body.pin ?? '');
      if (!author || !PIN_RE.test(pin)) return json({ error: 'no_pin' }, 400);

      const row = await env.DB.prepare('SELECT pin FROM users WHERE username = ?')
        .bind(author)
        .first();

      if (body.mode === 'inscription') {
        if (row) return json({ error: 'name_taken' }, 403);
        /* A new account creation — cap it with the global limiter. */
        const { success } = await env.RATE_LIMITER.limit({ key: 'global' });
        if (!success) return json({ error: 'rate_limited' }, 429);
        await env.DB.prepare('INSERT INTO users (username, pin, created_at) VALUES (?, ?, ?)')
          .bind(author, pin, Date.now())
          .run();
        return json({ ok: true, author });
      }

      if (!row) return json({ error: 'unknown' }, 404);
      if (row.pin !== pin) return json({ error: 'wrong_pin' }, 403);
      return json({ ok: true, author });
    }

    if (pathname === '/levels' && request.method === 'GET') {
      /* attempts = distinct clients who opened it, successes = those who solved it. */
      const { results } = await env.DB.prepare(
        `SELECT l.id, l.author, l.secret, l.words, l.created_at,
                COALESCE(s.attempts, 0) AS attempts,
                COALESCE(s.successes, 0) AS successes
         FROM levels l
         LEFT JOIN (
           SELECT level_id, COUNT(*) AS attempts, SUM(solved) AS successes
           FROM level_stats GROUP BY level_id
         ) s ON s.level_id = l.id
         ORDER BY l.created_at DESC`,
      ).all();
      return json(results.map((r) => ({ ...r, words: JSON.parse(r.words) })));
    }

    /* Record a play (attempt) or a completion (solve) for a level, keyed by the
     * caller's anonymous client id — no sign-in required. Deduped by the
     * (level, client) primary key: attempt inserts once; solve upserts to 1. */
    const stat = pathname.match(/^\/levels\/([^/]+)\/(attempt|solve)$/);
    if (stat && request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        /* no body → rejected below */
      }
      const client = String(body.client ?? '').slice(0, 64);
      if (!client) return json({ error: 'no_client' }, 400);
      const [, id, kind] = stat;
      const level = await env.DB.prepare('SELECT 1 FROM levels WHERE id = ?').bind(id).first();
      if (!level) return json({ error: 'not_found' }, 404);
      await recordPlay(env, id, kind, client);
      return json({ ok: true });
    }

    if (pathname === '/levels' && request.method === 'POST') {
      /* Fixed key → the cap is global (total submissions), not per-client. */
      const { success } = await env.RATE_LIMITER.limit({ key: 'global' });
      if (!success) return json({ error: 'rate_limited' }, 429);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'bad_json' }, 400);
      }

      const author = String(body.author ?? '')
        .trim()
        .slice(0, 20);
      const pin = String(body.pin ?? '');
      const auth = await authAuthor(env, author, pin, true);
      if (auth === 'no_pin') return json({ error: 'no_pin' }, 400);
      if (auth === 'mismatch') return json({ error: 'name_taken' }, 403);

      const challenge = parseChallenge(body);
      if (!challenge) return json({ error: 'invalid' }, 422);

      const id = newLevelId();
      const created_at = Date.now();
      await env.DB.prepare(
        'INSERT INTO levels (id, author, secret, words, created_at) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(id, author, challenge.secret, JSON.stringify(challenge.words), created_at)
        .run();
      return json(
        { id, author, secret: challenge.secret, words: challenge.words, created_at },
        201,
      );
    }

    const match = pathname.match(/^\/levels\/([^/]+)$/);

    /* Community levels are create-only — no edit endpoint. Admin edits daily
     * challenges through the dailies API instead. */

    if (match && request.method === 'DELETE') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        /* no body → not authorised below */
      }
      const level = await env.DB.prepare('SELECT author FROM levels WHERE id = ?')
        .bind(match[1])
        .first();
      if (!level) return json({ error: 'not_found' }, 404);
      const author = String(body.author ?? '').trim();
      const auth = await authAuthor(env, author, String(body.pin ?? ''), false);
      /* Own level, or the admin deleting anyone's. */
      if (auth !== 'ok' || (author !== ADMIN_NAME && author !== level.author))
        return json({ error: 'forbidden' }, 403);
      await env.DB.prepare('DELETE FROM levels WHERE id = ?').bind(match[1]).run();
      return json({ ok: true });
    }

    /* --- Daily challenges: like /levels, but keyed by ISO date and editable
     * only by the admin, only for today and future dates. --- */

    if (pathname === '/dailies' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT d.date, d.secret, d.words, d.updated_at,
                COALESCE(s.attempts, 0) AS attempts,
                COALESCE(s.successes, 0) AS successes
         FROM dailies d
         LEFT JOIN (
           SELECT level_id, COUNT(*) AS attempts, SUM(solved) AS successes
           FROM level_stats GROUP BY level_id
         ) s ON s.level_id = d.date
         ORDER BY d.date`,
      ).all();
      return json(results.map((r) => ({ ...r, words: JSON.parse(r.words) })));
    }

    if (pathname === '/dailies' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'bad_json' }, 400);
      }
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return json({ error: adminErr }, adminErr === 'no_pin' ? 400 : 403);

      const date = String(body.date ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad_date' }, 422);
      if (date < serverToday()) return json({ error: 'past_date' }, 422);
      const challenge = parseChallenge(body);
      if (!challenge) return json({ error: 'invalid' }, 422);
      const exists = await env.DB.prepare('SELECT 1 FROM dailies WHERE date = ?')
        .bind(date)
        .first();
      if (exists) return json({ error: 'date_taken' }, 409);

      const updated_at = Date.now();
      await env.DB.prepare(
        'INSERT INTO dailies (date, secret, words, updated_at) VALUES (?, ?, ?, ?)',
      )
        .bind(date, challenge.secret, JSON.stringify(challenge.words), updated_at)
        .run();
      return json(
        {
          date,
          secret: challenge.secret,
          words: challenge.words,
          updated_at,
          attempts: 0,
          successes: 0,
        },
        201,
      );
    }

    const dailyStat = pathname.match(/^\/dailies\/([^/]+)\/(attempt|solve)$/);
    if (dailyStat && request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        /* no body → rejected below */
      }
      const client = String(body.client ?? '').slice(0, 64);
      if (!client) return json({ error: 'no_client' }, 400);
      const [, date, kind] = dailyStat;
      const row = await env.DB.prepare('SELECT 1 FROM dailies WHERE date = ?').bind(date).first();
      if (!row) return json({ error: 'not_found' }, 404);
      await recordPlay(env, date, kind, client);
      return json({ ok: true });
    }

    const dailyMatch = pathname.match(/^\/dailies\/([^/]+)$/);

    if (dailyMatch && request.method === 'PUT') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'bad_json' }, 400);
      }
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return json({ error: adminErr }, adminErr === 'no_pin' ? 400 : 403);
      const date = dailyMatch[1];
      const row = await env.DB.prepare('SELECT 1 FROM dailies WHERE date = ?').bind(date).first();
      if (!row) return json({ error: 'not_found' }, 404);
      if (date < serverToday()) return json({ error: 'past_date' }, 422);
      const challenge = parseChallenge(body);
      if (!challenge) return json({ error: 'invalid' }, 422);
      const updated_at = Date.now();
      await env.DB.prepare(
        'UPDATE dailies SET secret = ?, words = ?, updated_at = ? WHERE date = ?',
      )
        .bind(challenge.secret, JSON.stringify(challenge.words), updated_at, date)
        .run();
      return json({ date, secret: challenge.secret, words: challenge.words, updated_at });
    }

    if (dailyMatch && request.method === 'DELETE') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        /* no body → not authorised below */
      }
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return json({ error: adminErr }, adminErr === 'no_pin' ? 400 : 403);
      const date = dailyMatch[1];
      const row = await env.DB.prepare('SELECT 1 FROM dailies WHERE date = ?').bind(date).first();
      if (!row) return json({ error: 'not_found' }, 404);
      if (date < serverToday()) return json({ error: 'past_date' }, 422);
      await env.DB.prepare('DELETE FROM dailies WHERE date = ?').bind(date).run();
      return json({ ok: true });
    }

    /* Full DB dump for the admin's manual backup (contains plaintext PINs, by
     * the same casual-auth design as the rest — admin-only). */
    if (pathname === '/admin/export' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'bad_json' }, 400);
      }
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return json({ error: adminErr }, adminErr === 'no_pin' ? 400 : 403);
      const [dailies, levels, users, stats] = await Promise.all([
        env.DB.prepare('SELECT * FROM dailies ORDER BY date').all(),
        env.DB.prepare('SELECT * FROM levels ORDER BY created_at').all(),
        env.DB.prepare('SELECT * FROM users ORDER BY created_at').all(),
        env.DB.prepare('SELECT * FROM level_stats').all(),
      ]);
      return json({
        exported_at: Date.now(),
        dailies: dailies.results,
        levels: levels.results,
        users: users.results,
        level_stats: stats.results,
      });
    }

    return json({ error: 'not_found' }, 404);
  },
};
