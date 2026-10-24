/*
 * A lemma's first French sense and its Wiktionnaire page, `{ sense, url }`, fetched
 * on demand and kept on the device. Resolves to null when there's none; a failed
 * request isn't kept, so the next one retries.
 */
import { readJSON, writeJSON, isObject } from '../../src/utils/storage.js';

const SITE = 'https://fr.wiktionary.org';
const KEY = 'lexilouhette:v2:definitions';

const saved = readJSON(KEY, {}, isObject);
const pending = new Map();

export function definitionOf(lemma) {
  if (lemma in saved) return Promise.resolve(saved[lemma]);
  if (!pending.has(lemma)) {
    const lookup = findDefinition(lemma)
      .then((definition) => {
        saved[lemma] = definition;
        writeJSON(KEY, saved);
        return definition;
      })
      .catch(() => null)
      .finally(() => pending.delete(lemma));
    pending.set(lemma, lookup);
  }
  return pending.get(lemma);
}

/* The dictionary spells œ out (soeur), the Wiktionnaire mostly doesn't. */
export const pageTitles = (lemma) =>
  lemma.includes('oe') ? [lemma.replaceAll('oe', 'œ'), lemma] : [lemma];

async function findDefinition(lemma) {
  for (const title of pageTitles(lemma)) {
    const sense = await fetchSense(title);
    if (sense) return { sense, url: `${SITE}/wiki/${encodeURIComponent(title)}` };
  }
  return null;
}

/* From the page's first section, which is the French one when the word is French. */
async function fetchSense(title) {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'text',
    section: '1',
    redirects: '1',
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  const res = await fetch(`${SITE}/w/api.php?${params}`);
  if (!res.ok) throw new Error(`Wiktionnaire: ${res.status}`);
  const data = await res.json();
  return data.parse ? firstSense(data.parse.text) : null;
}

/* The first numbered sense, without its sub-senses, examples and notes. */
function firstSense(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.getElementById('Français')) return null;
  const li = doc.querySelector('ol > li');
  if (!li) return null;
  li.querySelectorAll('ul, ol, dl, sup.reference, style').forEach((n) => n.remove());
  return li.textContent.replace(/\s+/g, ' ').trim() || null;
}
