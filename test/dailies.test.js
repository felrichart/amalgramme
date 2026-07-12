import { describe, it, expect, beforeEach, vi } from 'vitest';

/* Fix "today" so todayDate() is deterministic (getToday() otherwise throws
 * until resolveToday has run). */
vi.mock('../src/utils/today.js', () => ({
  getToday: () => '2026-06-20',
  resolveToday: async () => '2026-06-20',
  deviceTimeZone: () => 'UTC',
}));

import { setDailies, getDailies, dailyPuzzle, dailyRecord } from '../src/data/dailies.js';
import { todayDate, puzzleForDate, pastChallenges } from '../src/data/challenges.js';

const seed = (levels) =>
  localStorage.setItem('amalgramme:v3:dailies', JSON.stringify({ levels, fetchedAt: 1 }));

beforeEach(() => localStorage.clear());

describe('daily cache', () => {
  it('returns the bank oldest-first regardless of stored order', () => {
    setDailies(
      [
        { date: '2026-06-19', secret: 'b', words: ['a', 'b', 'c', 'd'] },
        { date: '2026-06-18', secret: 'a', words: ['a', 'b', 'c', 'd'] },
      ],
      1,
    );
    expect(getDailies().map((d) => d.date)).toEqual(['2026-06-18', '2026-06-19']);
  });

  it('resolves a puzzle shape by date, null for an unknown date', () => {
    seed([{ date: '2026-06-18', secret: 'suite', words: ['w1', 'w2', 'w3', 'w4'] }]);
    expect(dailyPuzzle('2026-06-18')).toEqual({
      date: '2026-06-18',
      secret: 'suite',
      words: ['w1', 'w2', 'w3', 'w4'],
    });
    expect(dailyRecord('2999-01-01')).toBeNull();
    expect(dailyPuzzle('2999-01-01')).toBeNull();
    expect(puzzleForDate('2026-06-18').secret).toBe('suite');
  });
});

describe('todayDate', () => {
  it('is null when the bank is empty', () => {
    expect(todayDate()).toBeNull();
  });

  it('picks the latest date not after today, and past excludes today', () => {
    seed([
      { date: '2026-06-18', secret: 'a', words: ['a', 'b', 'c', 'd'], attempts: 3, successes: 1 },
      { date: '2026-06-19', secret: 'b', words: ['a', 'b', 'c', 'd'], attempts: 5, successes: 2 },
      { date: '2026-06-25', secret: 'c', words: ['a', 'b', 'c', 'd'] },
    ]);
    expect(todayDate()).toBe('2026-06-19');
    /* Past = before today, newest first, carrying stats. */
    const past = pastChallenges();
    expect(past.map((p) => p.date)).toEqual(['2026-06-18']);
    expect(past[0].attempts).toBe(3);
  });
});
