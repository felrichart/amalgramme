/*
 * A base word's French senses, fetched from the Wiktionnaire on demand and kept on
 * the device, and its definition: the sense the admin picked (official.js), else
 * its first one of its own. Rejects when a request fails, which isn't kept, so the
 * next one retries.
 */
import { readJSON, writeJSON, isObject } from '../../src/utils/storage.js';
import { official } from './official.js';

const SITE = 'https://fr.wiktionary.org';
const KEY = 'lexilouhette:v8:senses';

const saved = readJSON(KEY, {}, isObject);
const pending = new Map();

/* `{ form, text }` per sense, `form` when its part is one of the "Forme de…" ones. */
export function sensesOf(word) {
  if (word in saved) return Promise.resolve(saved[word]);
  if (!pending.has(word)) {
    const lookup = lookUp(word)
      .then((senses) => {
        saved[word] = senses;
        writeJSON(KEY, saved);
        return senses;
      })
      .finally(() => pending.delete(word));
    pending.set(word, lookup);
  }
  return pending.get(word);
}

/* The sense shown by default: one of the word's own (Nom commun, Adjectif…), else
 * its first one; -1 when there's none. */
export function defaultSense(senses) {
  const own = senses.findIndex((s) => !s.form);
  return own >= 0 ? own : senses.length ? 0 : -1;
}

/* Resolves to null when there's none. */
export async function definitionOf(word) {
  const picked = official.definitions[word];
  if (picked) return picked.text;
  const senses = await sensesOf(word);
  return senses[defaultSense(senses)]?.text ?? null;
}

/* The dictionary spells œ out (soeur), the Wiktionnaire mostly doesn't. */
export const pageTitles = (word) =>
  word.includes('oe') ? [word.replaceAll('oe', 'œ'), word] : [word];

async function lookUp(word) {
  for (const title of pageTitles(word)) {
    const senses = await fetchSenses(title);
    if (senses.length) return senses;
  }
  return [];
}

/* The page's parse, null when there's no such page. */
async function parse(title, params) {
  const query = new URLSearchParams({
    action: 'parse',
    page: title,
    redirects: '1',
    format: 'json',
    formatversion: '2',
    origin: '*',
    ...params,
  });
  const res = await fetch(`${SITE}/w/api.php?${query}`);
  if (!res.ok) throw new Error(`Wiktionnaire: ${res.status}`);
  return (await res.json()).parse ?? null;
}

/* From the page's French section: mostly its first one, else the one its table of
 * contents points to (phylum opens on "Conventions internationales"). */
async function fetchSenses(title) {
  const first = await parse(title, { prop: 'text', section: '1' });
  if (!first) return [];
  const senses = parseSenses(first.text);
  if (senses) return senses;
  const { sections } = await parse(title, { prop: 'sections' });
  const french = sections.find((s) => s.toclevel === 1 && s.anchor === 'Français');
  if (!french) return [];
  return parseSenses((await parse(title, { prop: 'text', section: french.index })).text) ?? [];
}

/* Every numbered sense, part of speech by part, in page order, without its
 * sub-senses, examples and notes, but with the phrases it lists (pible: « Mot
 * désuet sauf dans l'expression : mât à pible »). Null when the section isn't the
 * French one. */
function parseSenses(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.getElementById('Français')) return null;
  const senses = [];
  // Null under the sections that aren't a part of speech (Étymologie, Références…).
  let part = null;
  for (const el of doc.querySelectorAll('h3, ol')) {
    if (el.tagName === 'H3') {
      part = el.querySelector('.titredef') ? el.id : null;
      continue;
    }
    // Sub-senses: inside a sense, or already cut from one.
    if (part === null || !el.isConnected || el.closest('li')) continue;
    for (const li of el.querySelectorAll(':scope > li')) {
      li.querySelectorAll('ol, dl, sup.reference, style').forEach((n) => n.remove());
      // Examples, quoted (.example) or written out with just their source.
      li.querySelectorAll('li:has(.example, .sources)').forEach((n) => n.remove());
      const text = li.textContent.replace(/\s+/g, ' ').trim();
      if (text) senses.push({ form: part.startsWith('Forme'), text });
    }
  }
  return senses;
}
