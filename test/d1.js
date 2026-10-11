/* In-memory D1 for Worker tests: node:sqlite with every real migration applied. */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = new URL('../server/migrations/', import.meta.url);

export function createD1() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(DIR).sort()) db.exec(readFileSync(new URL(f, DIR), 'utf8'));
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
  };
}
