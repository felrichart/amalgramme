import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateSaves,
  migrateCommunitySaves,
  migrateTutorial,
  tutorialState,
  levelProgress,
} from '../src/composables/useGameState.js';
import { listDailies } from '../src/data/challenges.js';

const V3 = 'amalgramme:v3:level:';
const read = (k) => JSON.parse(localStorage.getItem(k));

/* migrateSaves maps a legacy index i onto the i-th daily, so seed the daily
 * cache (the bank now lives in D1 + this localStorage cache, not challenges.json). */
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'amalgramme:v3:dailies',
    JSON.stringify({
      levels: [
        { date: '2026-06-18', secret: 'suite', words: ['a', 'b', 'c', 'd'] },
        { date: '2026-06-19', secret: 'couteau', words: ['a', 'b', 'c', 'd'] },
      ],
      fetchedAt: 1,
    }),
  );
});

describe('migrateSaves: legacy index keys → date keys', () => {
  it('moves an index save to its puzzle date key and preserves progress', () => {
    const date = listDailies()[0].date;
    localStorage.setItem(
      V3 + '0',
      JSON.stringify({
        solved: [true, true, true, true],
        shuffleSeeds: [1, 2, 3, 4],
        secretFound: true,
        secretPicks: [],
        completed: true,
      }),
    );

    migrateSaves();

    expect(localStorage.getItem(V3 + '0')).toBeNull();
    expect(read(V3 + date).completed).toBe(true);
    expect(levelProgress(date)).toMatchObject({ completed: true, found: 4 });
  });

  it('never overwrites an existing date key', () => {
    const date = listDailies()[0].date;
    localStorage.setItem(V3 + date, JSON.stringify({ solved: [true, true, true, true] }));
    localStorage.setItem(V3 + '0', JSON.stringify({ solved: [false, false, false, false] }));

    migrateSaves();

    expect(read(V3 + date).solved).toEqual([true, true, true, true]);
    expect(localStorage.getItem(V3 + '0')).toBeNull();
  });

  it('is a no-op when there are no legacy keys', () => {
    const date = listDailies()[0].date;
    localStorage.setItem(V3 + date, JSON.stringify({ solved: [true, false, false, false] }));

    migrateSaves();

    expect(read(V3 + date).solved).toEqual([true, false, false, false]);
  });
});

describe('migrateCommunitySaves: full-UUID keys → 8-char id keys', () => {
  const full = '550e8400-e29b-41d4-a716-446655440000';
  const COM = V3 + 'com-';

  it('re-keys a community save to its short id and preserves progress', () => {
    localStorage.setItem(
      COM + full,
      JSON.stringify({
        solved: [true, true, true, true],
        shuffleSeeds: [1, 2, 3, 4],
        secretFound: true,
        secretPicks: [],
        completed: true,
      }),
    );

    migrateCommunitySaves();

    expect(localStorage.getItem(COM + full)).toBeNull();
    expect(read(COM + '550e8400').completed).toBe(true);
    expect(levelProgress('com-550e8400')).toMatchObject({ completed: true, found: 4 });
  });

  it('leaves an already-short community key untouched', () => {
    localStorage.setItem(COM + '550e8400', JSON.stringify({ solved: [true, false, false, false] }));

    migrateCommunitySaves();

    expect(read(COM + '550e8400').solved).toEqual([true, false, false, false]);
  });

  it('never overwrites an existing short key', () => {
    localStorage.setItem(COM + '550e8400', JSON.stringify({ completed: true }));
    localStorage.setItem(COM + full, JSON.stringify({ completed: false }));

    migrateCommunitySaves();

    expect(read(COM + '550e8400').completed).toBe(true);
    expect(localStorage.getItem(COM + full)).toBeNull();
  });

  it('does not touch daily or tutorial keys', () => {
    localStorage.setItem(V3 + '2026-06-18', JSON.stringify({ completed: true }));
    localStorage.setItem(V3 + 'tutoriel', JSON.stringify({ completed: true }));

    migrateCommunitySaves();

    expect(read(V3 + '2026-06-18').completed).toBe(true);
    expect(read(V3 + 'tutoriel').completed).toBe(true);
  });
});

describe('migrateTutorial: legacy tutorial level → device-wide coach flag', () => {
  it('marks the coach done for a player who finished the old tutorial', () => {
    localStorage.setItem(V3 + 'tutoriel', JSON.stringify({ completed: true }));

    migrateTutorial();

    expect(localStorage.getItem(V3 + 'tutoriel')).toBeNull();
    expect(tutorialState()).toMatchObject({ done: true, keyboardSeen: true });
  });

  it('drops an unfinished tutorial save without marking the coach done', () => {
    localStorage.setItem(V3 + 'tutoriel', JSON.stringify({ solved: [true, false, false, false] }));

    migrateTutorial();

    expect(localStorage.getItem(V3 + 'tutoriel')).toBeNull();
    expect(tutorialState().done).toBe(false);
  });

  it('is a no-op with no legacy tutorial save', () => {
    migrateTutorial();

    expect(tutorialState().done).toBe(false);
  });
});
