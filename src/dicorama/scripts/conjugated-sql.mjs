/*
 * Prints the SQL that gives the official levels saved before migration 0015 their
 * verb forms, from bank.json: `node src/dicorama/scripts/conjugated-sql.mjs >
 * conjugated.sql`, then `wrangler d1 execute <db> --remote --file conjugated.sql`
 * from server/. A level that already has some keeps them.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const bank = JSON.parse(readFileSync(fileURLToPath(new URL('../bank.json', import.meta.url))));
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
for (const { pattern, conjugated } of bank) {
  if (!conjugated?.length) continue;
  console.log(
    `UPDATE dicorama_levels SET conjugated = ${quote(JSON.stringify(conjugated))} ` +
      `WHERE pattern = ${quote(pattern)} AND conjugated = '[]';`,
  );
}
