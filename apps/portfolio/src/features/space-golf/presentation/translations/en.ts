export const spaceGolfTranslationsEn = {
  hud: {
    holes: (count: number): string => `${count}`,
    strokes: (total: number, current: number): string => `${total} +${current}`,
    reset: 'Start a new world',
    resetConfirm: 'Press again to erase this world and start a new one',
    toBall: 'Back to the ball',
    overview: 'Look at the whole course',
    closeUp: 'Back to the playing scale',
    meters: (distance: number): string => `${distance} m`,
    compass: (distance: number): string => `The cup is ${distance} metres away`,
    foresight: (level: number, max: number): string => `Foresight: level ${level} of ${max}`,
    grip: (touches: number): string => `Grip: ${touches} touches left`,
    scale: (meters: number): string => `Scale: the bar is ${meters} m long`,
  },
  status: {
    loading: 'Charting the course…',
  },
  help: {
    aim: 'Press anywhere and pull the band; the ball flies the other way. Any straight wall you hit becomes the floor. Two fingers, the wheel or the right button look around; the arrow points to the cup. The course never ends: every cup opens the next.',
  },
} as const;
