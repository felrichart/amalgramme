/*
 * The four word accents, one per puzzle piece (w0..w3): mustard, sage,
 * periwinkle, rose. Values are CSS custom properties defined in style.css.
 */
export const WORD_TINTS = ['var(--gold)', 'var(--teal)', 'var(--violet)', 'var(--pink)'];
export const TILE_TINTS = ['var(--accent)', ...WORD_TINTS];
