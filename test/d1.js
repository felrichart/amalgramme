/* In-memory D1 for Worker tests: node:sqlite with every real migration applied. */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = new URL('../server/migrations/', import.meta.url);

const MIGRATIONS = readdirSync(DIR).sort();

/* Migrations named before `until` (e.g. '0011') only, when given; `migrate(name)`
 * applies one later, to test it over seeded rows. */
export function createD1({ until } = {}) {
  const db = new DatabaseSync(':memory:');
  const migrate = (f) => db.exec(readFileSync(new URL(f, DIR), 'utf8'));
  MIGRATIONS.filter((f) => !until || f < until).forEach(migrate);
  const prepare = (sql) => {
    let args = [];
    const stmt = {
      bind: (...a) => ((args = a), stmt),
      first: async () => db.prepare(sql).get(...args) ?? null,
      run: async () => ({ success: true, meta: db.prepare(sql).run(...args) }),
      all: async () => ({ results: db.prepare(sql).all(...args) }),
    };
    return stmt;
  };
  return {
    prepare,
    batch: async (stmts) => {
      for (const s of stmts) await s.run();
    },
    sql: (query, ...args) => db.prepare(query).all(...args),
    migrate: (prefix) => migrate(MIGRATIONS.find((f) => f.startsWith(prefix))),
  };
}
