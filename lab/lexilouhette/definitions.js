/*
 * A base word's first French sense, fetched from the Wiktionnaire on demand and
 * kept on the device. Resolves to null when there's none; rejects when a request
 * fails, which isn't kept, so the next one retries.
 */
import { readJSON, writeJSON, isObject } from '../../src/utils/storage.js';

const SITE = 'https://fr.wiktionary.org';
const KEY = 'lexilouhette:v5:definitions';

const saved = readJSON(KEY, {}, isObject);
const pending = new Map();

export function definitionOf(word) {
  if (word in saved) return Promise.resolve(saved[word]);
  if (!pending.has(word)) {
    const lookup = lookUp(word)
      .then((definition) => {
        saved[word] = definition;
        writeJSON(KEY, saved);
        return definition;
      })
      .finally(() => pending.delete(word));
    pending.set(word, lookup);
  }
  return pending.get(word);
}

/* The dictionary spells œ out (soeur), the Wiktionnaire mostly doesn't. */
export const pageTitles = (word) =>
  word.includes('oe') ? [word.replaceAll('oe', 'œ'), word] : [word];

/* A sense of the word's own (Nom commun, Adjectif…), else its first one. */
async function lookUp(word) {
  for (const title of pageTitles(word)) {
    const senses = await fetchSenses(title);
    if (senses.length) return (senses.find((s) => !s.form) ?? senses[0]).text;
  }
  return null;
}

/* From the page's first section, which is the French one when the word is French. */
async function fetchSenses(title) {
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
  return data.parse ? sensesOf(data.parse.text) : [];
}

/*
 * The first numbered sense under each part of speech, in page order, without its
 * sub-senses, examples and notes. `form` when the part is one of the "Forme de…"
 * ones.
 */
function sensesOf(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.getElementById('Français')) return [];
  const senses = [];
  let part = '';
  for (const el of doc.querySelectorAll('h3, ol')) {
    if (el.tagName === 'H3') {
      part = el.id;
      continue;
    }
    // Sub-senses: inside a sense, or already cut from one.
    const li = !el.isConnected || el.closest('li') ? null : el.querySelector(':scope > li');
    if (!li) continue;
    li.querySelectorAll('ul, ol, dl, sup.reference, style').forEach((n) => n.remove());
    const text = li.textContent.replace(/\s+/g, ' ').trim();
    if (text) senses.push({ form: part.startsWith('Forme'), text });
  }
  return senses;
}
