import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const OFFICIAL = fileURLToPath(new URL('lexilouhette/official.json', import.meta.url));

/* lexilouhette/official.json, one level or definition per line. */
function officialFile({ levels = [], definitions = {} }) {
  const block = (open, items, close) =>
    items.length
      ? `${open}\n${items.map((x) => `    ${x}`).join(',\n')}\n  ${close}`
      : open + close;
  const levelLines = levels.map((l) => JSON.stringify(l));
  const defLines = Object.entries(definitions).map(
    ([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`,
  );
  return `{\n  "levels": ${block('[', levelLines, ']')},\n  "definitions": ${block('{', defLines, '}')}\n}\n`;
}

/* Reads and writes Lexilouhette's official levels for lexilouhette/official.js. */
function officialLevels() {
  return {
    name: 'lexilouhette-official',
    configureServer(server) {
      server.middlewares.use('/__lexilouhette/official', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'GET') {
          res.end(existsSync(OFFICIAL) ? await readFile(OFFICIAL, 'utf8') : '{}');
        } else if (req.method === 'PUT') {
          let body = '';
          for await (const chunk of req) body += chunk;
          try {
            await writeFile(OFFICIAL, officialFile(JSON.parse(body)));
            res.end('{}');
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: String(err) }));
          }
        } else {
          res.statusCode = 405;
          res.end('{}');
        }
      });
    },
  };
}

// Local-only playground for new game concepts (`npm run lab`). The production
// build starts from the root index.html and never reaches this folder.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [vue(), officialLevels()],
  server: { port: 5174, watch: { ignored: [OFFICIAL] } },
});
