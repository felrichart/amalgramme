/* Dicorama's look, loaded with its first view: fonts and shared styles. */
import './dicorama.css';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Young+Serif&family=Courier+Prime:wght@700&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap';

if (!document.querySelector(`link[href="${FONTS}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS;
  document.head.append(link);
}
