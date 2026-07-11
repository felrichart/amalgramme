/*
 * The four word accents, one per wheel/corner (w0..w3), in canonical order:
 * gold, teal, violet, pink. GameView tints the corner wheels with these and
 * LetterKeyboard tints its rows the same way, so the tray matches each wheel.
 * Values are CSS custom properties defined in style.css.
 */
export const WHEEL_TINTS = ['var(--gold)', 'var(--teal)', 'var(--violet)', 'var(--pink)'];
export const TILE_TINTS = ['var(--accent)', ...WHEEL_TINTS];
