/*
 * The four word accents, one per puzzle piece (w0..w3), in canonical order:
 * gold, teal, violet, pink. The secret's letter stock reuses them per row.
 * Values are CSS custom properties defined in style.css.
 */
export const WORD_TINTS = ['var(--gold)', 'var(--teal)', 'var(--violet)', 'var(--pink)'];
export const TILE_TINTS = ['var(--accent)', ...WORD_TINTS];
