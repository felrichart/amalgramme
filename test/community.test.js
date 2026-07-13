import { describe, it, expect, beforeEach } from 'vitest';
import { dateForSlug } from '../src/data/challenges.js';
import { shortCommunityId, shortCommunityDate, getCache, setCache } from '../src/data/community.js';

const full = '550e8400-e29b-41d4-a716-446655440000';

describe('community id shortening', () => {
  it('trims a bare id to 8 chars, leaving an already-short id alone', () => {
    expect(shortCommunityId(full)).toBe('550e8400');
    expect(shortCommunityId('550e8400')).toBe('550e8400');
  });

  it('canonicalizes a com- date (legacy full id → short)', () => {
    expect(shortCommunityDate('com-' + full)).toBe('com-550e8400');
    expect(shortCommunityDate('com-550e8400')).toBe('com-550e8400');
  });
});

describe('dateForSlug: legacy community URLs still resolve', () => {
  it('collapses a full-UUID slug onto the short community date', () => {
    expect(dateForSlug('com-' + full)).toBe('com-550e8400');
  });

  it('leaves a daily date slug unchanged', () => {
    expect(dateForSlug('2026-06-18')).toBe('2026-06-18');
  });
});

describe('getCache: ids are trimmed on read', () => {
  beforeEach(() => localStorage.clear());

  it('trims a full-UUID id stored in a stale cache', () => {
    setCache(
      [{ id: full, author: 'a', secret: 'x', words: ['a', 'b', 'c', 'd'], created_at: 1 }],
      1,
    );
    expect(getCache()[0].id).toBe('550e8400');
  });
});
