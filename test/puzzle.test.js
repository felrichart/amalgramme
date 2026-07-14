import { describe, it, expect } from 'vitest';
import { buildWords, buildSecret, buildHint, shuffle, normalize } from '../src/game/puzzle.js';

describe('buildWords', () => {
  it('strips spaces for the wheel but records the gap in layout/display', () => {
    const [w] = buildWords({ words: ['jeu video'], secret: 'x' });
    expect(w.text).toBe('jeuvideo');
    expect(w.display).toBe('jeu video');
    expect(w.length).toBe(8);
    // gap sits after the 3rd letter (index 2)
    expect(w.layout[2]).toBe(true);
    expect(w.layout.filter(Boolean)).toHaveLength(1);
  });

  it('treats hyphen and apostrophe as gaps like a space', () => {
    const [w] = buildWords({ words: ["aujourd'hui"], secret: 'x' });
    expect(w.text).toBe('aujourdhui');
    expect(w.display).toBe("aujourd'hui");
    // gap sits after the 7th letter (index 6)
    expect(w.layout[6]).toBe(true);
    expect(w.layout.filter(Boolean)).toHaveLength(1);
  });

  it('gives every tile a stable id, even for repeated letters', () => {
    const [w] = buildWords({ words: ['ciel'], secret: 'x' });
    expect(w.letters).toEqual([
      { id: 0, ch: 'c' },
      { id: 1, ch: 'i' },
      { id: 2, ch: 'e' },
      { id: 3, ch: 'l' },
    ]);
  });
});

describe('buildSecret', () => {
  it('parses spaces like a word', () => {
    const s = buildSecret({ secret: 'porto rico', words: [] });
    expect(s.text).toBe('portorico');
    expect(s.layout.filter(Boolean)).toHaveLength(1);
  });
});

describe('buildHint', () => {
  it('parses the extra hint like a word, keeping gaps', () => {
    const h = buildHint({ hint: 'porte cle', secret: 'x', words: [] });
    expect(h.text).toBe('portecle');
    expect(h.display).toBe('porte cle');
    expect(h.layout.filter(Boolean)).toHaveLength(1);
  });

  it('is null when the puzzle carries no hint', () => {
    expect(buildHint({ secret: 'x', words: [] })).toBeNull();
    expect(buildHint({ hint: '', secret: 'x', words: [] })).toBeNull();
  });
});

describe('shuffle', () => {
  it('is deterministic per seed and preserves the multiset', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    expect(shuffle(arr, 42)).toEqual(shuffle(arr, 42));
    expect([...shuffle(arr, 42)].sort()).toEqual(arr);
  });

  it('differs across seeds', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    expect(shuffle(arr, 1)).not.toEqual(shuffle(arr, 2));
  });

  it('does not mutate the input', () => {
    const arr = [1, 2, 3];
    shuffle(arr, 9);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe('normalize', () => {
  it('strips diacritics and lowercases', () => {
    expect(normalize('É')).toBe('e');
    expect(normalize('ç')).toBe('c');
    expect(normalize('A')).toBe('a');
  });
});
