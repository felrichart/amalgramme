import { ref, computed, watch, nextTick } from 'vue';
import { tutorialState, saveTutorialState } from '../data/tutorial.js';
import { savedProgress } from '../data/progress.js';

const GOLD = (text) => `<span style="color:var(--gold);font-weight:900">${text}</span>`;
const WHEELS = [0, 1, 2, 3].map((i) => `[data-cell="${i}"] .wheel`);

/* Lone hint the first time the secret keyboard opens; dismissed by typing. */
const SECRET_STEPS = [
  {
    selector: '[data-tut="dock"]',
    shape: 'rect',
    html: 'Appuie sur les lettres pour taper le <strong>mot énigme</strong>.',
  },
];

/*
 * The first-play walkthrough over the board (see TutorialCoach), shown only to a
 * player with no saved progress anywhere. Steps advance on the taught gesture
 * ("action") or a button ("manual"); it can't be skipped. Progress is per device.
 */
export function useCoach(g) {
  const tut = tutorialState();
  const firstPlay = savedProgress().length === 0;
  const enabled = firstPlay && !tut.done;

  /* The word just solved, spotlighted by the "Bravo" step. */
  const foundCell = ref(0);
  const steps = computed(() => [
    { holes: WHEELS, html: `Il y a 4 ${GOLD('indices')}, dont les lettres sont mélangées.` },
    {
      selector: '[data-tut="dock"]',
      shape: 'rect',
      text: 'Glisse d’une lettre à l’autre pour écrire le mot.',
    },
    {
      selector: `[data-cell="${foundCell.value}"]`,
      manual: true,
      html: `Bravo, plus que 3 ${GOLD('indices')} à trouver !`,
    },
    {
      selector: '[data-tut="secret"]',
      shape: 'rect',
      manual: true,
      cta: 'Compris',
      html: `Devine le <strong>mot énigme</strong> au centre grâce aux 4 ${GOLD('indices')}.`,
    },
  ]);

  const open = ref(enabled && !g.state.completed);
  const step = ref(tut.step ?? 0);

  function next() {
    if (step.value >= steps.value.length - 1) {
      open.value = false;
      saveTutorialState({ done: true, step: step.value });
    } else {
      saveTutorialState({ step: ++step.value });
    }
  }

  /* The "Glisse" step (1) hides once two letters are traced, and the coach
   * returns on "Bravo" when the first word is found. */
  if (enabled) {
    watch(
      () => g.path.length,
      (n) => {
        if (open.value && step.value === 1 && n >= 2) open.value = false;
      },
    );
    watch(
      () => g.solved.filter(Boolean).length,
      (n, o) => {
        if (step.value !== 1 || n <= o) return;
        foundCell.value = g.solved.findIndex(Boolean);
        step.value = 2;
        open.value = true;
        saveTutorialState({ step: 2 });
      },
    );
  }

  const secretOpen = ref(false);
  if (firstPlay && !tut.keyboardSeen) {
    let shown = false;
    watch(g.secretActive, (active) => {
      if (!active || open.value || shown) return;
      shown = true;
      saveTutorialState({ keyboardSeen: true });
      nextTick(() => (secretOpen.value = true));
    });
    watch(
      () => g.secretInput.value.length,
      (n, o) => {
        if (n > o) secretOpen.value = false;
      },
    );
  }

  return { open, step, steps, next, secretOpen, secretSteps: SECRET_STEPS };
}
