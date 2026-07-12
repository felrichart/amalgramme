var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type"
};
var ADMIN_NAME = "cara+";
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS }
  });
}
__name(json, "json");
var MAX_LETTERS = 11;
var MIN_LETTERS = 4;
var MAX_SEP = 2;
function isSep(ch) {
  return ch === " " || ch === "-" || ch === "'";
}
__name(isSep, "isSep");
function normalizeWord(raw) {
  const chars = String(raw ?? "").replace(/’/g, "'").split("").map((ch) => isSep(ch) ? ch : ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
  let out = "";
  let prevSep = true;
  for (const ch of chars) {
    const sep = isSep(ch);
    if (sep && prevSep) continue;
    out += ch;
    prevSep = sep;
  }
  return out.replace(/[ \-']+$/, "");
}
__name(normalizeWord, "normalizeWord");
function wordError(w) {
  if (!w) return "empty";
  let letters = 0;
  let sp = 0;
  let hy = 0;
  let ap = 0;
  let other = 0;
  for (const ch of w) {
    if (ch >= "a" && ch <= "z") letters++;
    else if (ch === " ") sp++;
    else if (ch === "-") hy++;
    else if (ch === "'") ap++;
    else other++;
  }
  if (other > 0) return "char";
  if (letters < 1) return "empty";
  if (letters < MIN_LETTERS) return "short";
  if (letters > MAX_LETTERS) return "long";
  if (sp > MAX_SEP || hy > MAX_SEP || ap > MAX_SEP) return "sep";
  return null;
}
__name(wordError, "wordError");
function bag(w) {
  const b = {};
  for (const ch of w) if (ch >= "a" && ch <= "z") b[ch] = (b[ch] || 0) + 1;
  return b;
}
__name(bag, "bag");
function canBuild(secret, words) {
  const pool = {};
  for (const w of words) {
    const b = bag(w);
    for (const ch in b) pool[ch] = (pool[ch] || 0) + b[ch];
  }
  const need = bag(secret);
  for (const ch in need) if ((pool[ch] || 0) < need[ch]) return false;
  return true;
}
__name(canBuild, "canBuild");
var PIN_RE = /^\d{4}$/;
function parseChallenge(body) {
  const words = Array.isArray(body.words) ? body.words.map(normalizeWord) : [];
  const secret = normalizeWord(body.secret);
  const valid = words.length === 4 && !words.some((w) => wordError(w)) && !wordError(secret) && canBuild(secret, words);
  return valid ? { words, secret } : null;
}
__name(parseChallenge, "parseChallenge");
async function authAuthor(env, name, pin, create) {
  if (!name || !PIN_RE.test(pin)) return "no_pin";
  const row = await env.DB.prepare("SELECT pin FROM users WHERE username = ?").bind(name).first();
  if (row) return row.pin === pin ? "ok" : "mismatch";
  if (!create) return "mismatch";
  await env.DB.prepare("INSERT INTO users (username, pin, created_at) VALUES (?, ?, ?)").bind(name, pin, Date.now()).run();
  return "ok";
}
__name(authAuthor, "authAuthor");
var worker_default = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (pathname === "/auth" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad_json" }, 400);
      }
      const author = String(body.author ?? "").trim().slice(0, 20);
      const pin = String(body.pin ?? "");
      if (!author || !PIN_RE.test(pin)) return json({ error: "no_pin" }, 400);
      const row = await env.DB.prepare("SELECT pin FROM users WHERE username = ?").bind(author).first();
      if (body.mode === "inscription") {
        if (row) return json({ error: "name_taken" }, 403);
        const { success } = await env.RATE_LIMITER.limit({ key: "global" });
        if (!success) return json({ error: "rate_limited" }, 429);
        await env.DB.prepare("INSERT INTO users (username, pin, created_at) VALUES (?, ?, ?)").bind(author, pin, Date.now()).run();
        return json({ ok: true, author });
      }
      if (!row) return json({ error: "unknown" }, 404);
      if (row.pin !== pin) return json({ error: "wrong_pin" }, 403);
      return json({ ok: true, author });
    }
    if (pathname === "/levels" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, author, secret, words, created_at FROM levels ORDER BY created_at DESC"
      ).all();
      return json(results.map((r) => ({ ...r, words: JSON.parse(r.words) })));
    }
    if (pathname === "/levels" && request.method === "POST") {
      const { success } = await env.RATE_LIMITER.limit({ key: "global" });
      if (!success) return json({ error: "rate_limited" }, 429);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad_json" }, 400);
      }
      const author = String(body.author ?? "").trim().slice(0, 20);
      const pin = String(body.pin ?? "");
      const auth = await authAuthor(env, author, pin, true);
      if (auth === "no_pin") return json({ error: "no_pin" }, 400);
      if (auth === "mismatch") return json({ error: "name_taken" }, 403);
      const challenge = parseChallenge(body);
      if (!challenge) return json({ error: "invalid" }, 422);
      const id = crypto.randomUUID();
      const created_at = Date.now();
      await env.DB.prepare(
        "INSERT INTO levels (id, author, secret, words, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, author, challenge.secret, JSON.stringify(challenge.words), created_at).run();
      return json(
        { id, author, secret: challenge.secret, words: challenge.words, created_at },
        201
      );
    }
    const match = pathname.match(/^\/levels\/([^/]+)$/);
    if (match && request.method === "PUT") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad_json" }, 400);
      }
      const level = await env.DB.prepare("SELECT author FROM levels WHERE id = ?").bind(match[1]).first();
      if (!level) return json({ error: "not_found" }, 404);
      const author = String(body.author ?? "").trim();
      const auth = await authAuthor(env, author, String(body.pin ?? ""), false);
      if (auth !== "ok" || author !== ADMIN_NAME && author !== level.author)
        return json({ error: "forbidden" }, 403);
      const challenge = parseChallenge(body);
      if (!challenge) return json({ error: "invalid" }, 422);
      await env.DB.prepare("UPDATE levels SET secret = ?, words = ? WHERE id = ?").bind(challenge.secret, JSON.stringify(challenge.words), match[1]).run();
      const row = await env.DB.prepare(
        "SELECT id, author, secret, words, created_at FROM levels WHERE id = ?"
      ).bind(match[1]).first();
      return json({ ...row, words: JSON.parse(row.words) });
    }
    if (match && request.method === "DELETE") {
      let body = {};
      try {
        body = await request.json();
      } catch {
      }
      const level = await env.DB.prepare("SELECT author FROM levels WHERE id = ?").bind(match[1]).first();
      if (!level) return json({ error: "not_found" }, 404);
      const author = String(body.author ?? "").trim();
      const auth = await authAuthor(env, author, String(body.pin ?? ""), false);
      if (auth !== "ok" || author !== ADMIN_NAME && author !== level.author)
        return json({ error: "forbidden" }, 403);
      await env.DB.prepare("DELETE FROM levels WHERE id = ?").bind(match[1]).run();
      return json({ ok: true });
    }
    return json({ error: "not_found" }, 404);
  }
};

// ../../../.asdf/installs/nodejs/24.13.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../.asdf/installs/nodejs/24.13.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-FuGMRR/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../.asdf/installs/nodejs/24.13.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-FuGMRR/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
