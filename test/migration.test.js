import { describe, it, expect, beforeEach } from 'vitest';
import { migrateSaves, levelProgress } from '../src/composables/useGameState.js';
import { PUZZLES } from '../src/data/challenges.js';

const V3 = 'amalgramme:v3:level:';
const read = (k) => JSON.parse(localStorage.getItem(k));

beforeEach(() => localStorage.clear());

describe('migrateSaves: legacy index keys → date keys', () => {
  it('moves an index save to its puzzle date key and preserves progress', () => {
    const date = PUZZLES[0].date;
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
    const date = PUZZLES[0].date;
    localStorage.setItem(V3 + date, JSON.stringify({ solved: [true, true, true, true] }));
    localStorage.setItem(V3 + '0', JSON.stringify({ solved: [false, false, false, false] }));

    migrateSaves();

    expect(read(V3 + date).solved).toEqual([true, true, true, true]);
    expect(localStorage.getItem(V3 + '0')).toBeNull();
  });

  it('is a no-op when there are no legacy keys', () => {
    const date = PUZZLES[0].date;
    localStorage.setItem(V3 + date, JSON.stringify({ solved: [true, false, false, false] }));

    migrateSaves();

    expect(read(V3 + date).solved).toEqual([true, false, false, false]);
  });
});
