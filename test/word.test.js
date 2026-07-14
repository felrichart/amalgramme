import { describe, it, expect } from 'vitest';
import { normalizeWord, wordError, canBuildSecret, validateChallenge } from '../src/game/word.js';

describe('normalizeWord', () => {
  it('folds diacritics and lowercases', () => {
    expect(normalizeWord('Bébé')).toBe('bebe');
    expect(normalizeWord('ÇA VA')).toBe('ca va');
  });
  it('folds the typographic apostrophe and keeps separators', () => {
    expect(normalizeWord('aujourd’hui')).toBe("aujourd'hui");
    expect(normalizeWord('arc-en-ciel')).toBe('arc-en-ciel');
  });
  it('collapses runs of separators and trims the edges', () => {
    expect(normalizeWord('  jeu   video  ')).toBe('jeu video');
    expect(normalizeWord('-mot-')).toBe('mot');
  });
});

describe('wordError', () => {
  it('accepts a plain word and separators within the caps', () => {
    expect(wordError('console')).toBeNull();
    expect(wordError('arc-en-ciel')).toBeNull();
  });
  it('rejects forbidden characters', () => {
    expect(wordError('mot1')).toBe('char');
    expect(wordError('mot.')).toBe('char');
  });
  it('rejects over 12 letters', () => {
    expect(wordError('abcdefghijklm')).toBe('long'); // 13 letters
    expect(wordError('abcdefghijkl')).toBeNull(); // 12 letters ok
  });
  it('rejects more than 4 separators', () => {
    expect(wordError('a-b-c-d-e-f')).toBe('sep'); // 5 hyphens, 6 letters
    expect(wordError('a-b-c-d-e')).toBeNull(); // 4 hyphens, 5 letters ok
  });
  it('rejects fewer than 3 letters (but not empty)', () => {
    expect(wordError('mo')).toBe('short'); // 2 letters
    expect(wordError('ab')).toBe('short');
    expect(wordError('mot')).toBeNull(); // 3 letters ok
  });
  it('rejects empty', () => {
    expect(wordError('')).toBe('empty');
  });
});

describe('canBuildSecret', () => {
  it('is true when the secret draws from the pooled letters (ignoring separators)', () => {
    expect(canBuildSecret('console', ['meuble', 'jeu video', 'terminal', 'joystick'])).toBe(true);
  });
  it('is false when a letter is missing', () => {
    expect(canBuildSecret('zzz', ['meuble', 'jeu', 'terminal', 'os'])).toBe(false);
  });
  it('respects letter multiplicity', () => {
    expect(canBuildSecret('aa', ['a', 'b', 'c', 'd'])).toBe(false);
    expect(canBuildSecret('aa', ['a', 'a', 'c', 'd'])).toBe(true);
  });
});

describe('validateChallenge', () => {
  const author = 'Marc';
  it('passes a valid, buildable set', () => {
    const v = validateChallenge({
      author,
      words: ['carotte', 'salade', 'oignon', 'poireau'],
      secret: 'cornaline',
      hint: 'legume',
    });
    expect(v.ok).toBe(true);
    expect(v.normalized.words).toEqual(['carotte', 'salade', 'oignon', 'poireau']);
  });
  it('fails when the énigme is not buildable', () => {
    const v = validateChallenge({
      author,
      words: ['aaa', 'bbb', 'ccc', 'ddd'],
      secret: 'zzz',
    });
    expect(v.ok).toBe(false);
    expect(v.buildable).toBe(false);
  });
  it('flags a repeated index as dup', () => {
    const v = validateChallenge({
      author,
      words: ['carotte', 'salade', 'carotte', 'poireau'],
      secret: 'cornaline',
    });
    expect(v.ok).toBe(false);
    expect(v.words).toEqual([null, null, 'dup', null]);
  });
  it('fails on an empty author', () => {
    const v = validateChallenge({
      author: '',
      words: ['carotte', 'salade', 'oignon', 'poireau'],
      secret: 'carotte',
    });
    expect(v.ok).toBe(false);
    expect(v.author).toBe('empty');
  });

  const withHint = (hint) =>
    validateChallenge({
      author,
      words: ['carotte', 'salade', 'oignon', 'poireau'],
      secret: 'cornaline',
      hint,
    });

  it('requires a hint: empty fails to validate', () => {
    const v = withHint('');
    expect(v.ok).toBe(false);
    expect(v.hint).toBe('empty');
    expect(v.normalized.hint).toBeNull();
  });

  it('normalises a filled-in hint and passes when valid and distinct', () => {
    const v = withHint('Légume');
    expect(v.hint).toBeNull();
    expect(v.normalized.hint).toBe('legume');
    expect(v.ok).toBe(true);
  });

  it('rejects an invalid hint word', () => {
    const v = withHint('ab');
    expect(v.hint).toBe('short');
    expect(v.ok).toBe(false);
  });

  it('rejects a hint duplicating an index or the secret', () => {
    expect(withHint('carotte').hint).toBe('dup');
    expect(withHint('cornaline').hint).toBe('dup');
  });
});
