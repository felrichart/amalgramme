/*
 * The official levels, edited and validated by the admin, and the definitions the
 * admin picked. Kept in lab/lexilouhette/official.json through the lab's dev
 * server (see lab/vite.config.js), until it moves to our Worker.
 *
 * `levels`: `{ pattern, status: 'draft' | 'valid', words, rare, banned }` (see buildLevel
 * in game.js), validated ones in the order they were first validated; players
 * only get those. `definitions`: base → `{ index, text }`, the Wiktionnaire sense
 * picked for that word, in every level.
 */
import { reactive } from 'vue';

// Everyone is admin while in development.
export const isAdmin = import.meta.env.DEV;

const ENDPOINT = '/__lexilouhette/official';

export const official = reactive({ levels: [], definitions: {} });

/* Resolves once loaded, also when it fails (no official levels then). */
export async function loadOfficial() {
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) return;
    const data = await res.json();
    official.levels = data.levels ?? [];
    official.definitions = data.definitions ?? {};
  } catch {
    // Nothing official then.
  }
}

async function persist() {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(official),
    });
    if (res.ok) return { ok: true };
  } catch {
    // Reported below.
  }
  return { ok: false, error: "Impossible d'enregistrer les niveaux officiels." };
}

export const officialLevel = (pattern) => official.levels.find((l) => l.pattern === pattern);

/* The official levels one can play: drafts too for the admin. */
export const playableLevels = () => official.levels.filter((l) => isAdmin || l.status === 'valid');

/* Saves a draft as `status`; one validated for the first time goes last. */
export function saveLevel(draft, status) {
  const old = officialLevel(draft.pattern);
  const { pattern, words, rare, banned } = draft;
  // A plain copy, not the editor's reactive draft.
  const level = JSON.parse(JSON.stringify({ pattern, status, words, rare, banned }));
  const others = official.levels.filter((l) => l !== old);
  if (old && (old.status === 'valid' || status !== 'valid'))
    official.levels = official.levels.map((l) => (l === old ? level : l));
  else official.levels = [...others, level];
  return persist();
}

export function removeLevel(pattern) {
  official.levels = official.levels.filter((l) => l.pattern !== pattern);
  return persist();
}

/* `choice`: `{ index, text }`, or null for the word's default sense. */
export function setDefinition(base, choice) {
  const rest = Object.entries(official.definitions).filter(([b]) => b !== base);
  official.definitions = Object.fromEntries(choice ? [...rest, [base, choice]] : rest);
  return persist();
}
