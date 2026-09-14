export const spaceGolfTranslationsEn = {
  hud: {
    level: (number: number): string => `Level ${number}`,
    strokes: (total: number, current: number): string => `${total} +${current}`,
    restart: 'Restart the level',
    previous: 'Previous level',
    next: 'Next level',
  },
  status: {
    loading: 'Building the course…',
  },
  complete: {
    title: 'In the hole!',
    strokes: (strokes: number): string => `${strokes} strokes`,
    again: 'Play again',
  },
  help: {
    aim: 'Press anywhere and pull the band; the ball flies the other way. Any straight wall you hit becomes the floor. The board is open: a ball that flies off and cannot come back bursts.',
  },
} as const;
