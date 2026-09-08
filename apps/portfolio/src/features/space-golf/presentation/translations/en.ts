export const spaceGolfTranslationsEn = {
  hud: {
    level: (number: number): string => `Level ${number}`,
    strokes: (total: number, current: number): string => `${total} +${current}`,
    par: (par: number): string => `par ${par}`,
    pickups: (collected: number, total: number): string => `${collected}/${total}`,
    restart: 'Restart the level',
  },
  status: {
    loading: 'Building the course…',
    failed: 'The course could not be built. Reload the page to try again.',
  },
  complete: {
    title: 'In the hole!',
    strokes: (strokes: number, par: number): string => `${strokes} strokes · par ${par}`,
    next: 'Next level',
    again: 'Play again',
  },
  help: {
    aim: 'Press anywhere and pull the band; the ball flies the other way. Any straight wall you hit becomes the floor. The board is open: a ball gone for three seconds bursts.',
  },
} as const;
