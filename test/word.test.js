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
  it('rejects over 11 letters', () => {
    expect(wordError('abcdefghijkl')).toBe('long'); // 12 letters
    expect(wordError('abcdefghijk')).toBeNull(); // 11 letters
  });
  it('rejects more than 2 of a separator', () => {
    expect(wordError('a-b-c-d')).toBe('sep'); // 3 hyphens, 4 letters
    expect(wordError('a b cd')).toBeNull(); // 2 spaces, 4 letters ok
  });
  it('rejects fewer than 4 letters (but not empty)', () => {
    expect(wordError('mot')).toBe('short'); // 3 letters
    expect(wordError('jeu')).toBe('short');
    expect(wordError('jeux')).toBeNull(); // 4 letters ok
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
  it('fails on an empty author', () => {
    const v = validateChallenge({
      author: '',
      words: ['carotte', 'salade', 'oignon', 'poireau'],
      secret: 'carotte',
    });
    expect(v.ok).toBe(false);
    expect(v.author).toBe('empty');
  });
});
