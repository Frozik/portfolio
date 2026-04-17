export const stereometryTranslationsEn = {
  toolbar: {
    undo: 'Undo',
    redo: 'Redo',
    rotate: 'Rotate',
    pan: 'Pan',
    help: 'Help',
    puzzle: 'Puzzle',
    close: 'Close',
  },
  puzzles: {
    puzzle_1_1: {
      name: 'Section of a pentagonal pyramid',
      description:
        'Construct a cross-section of the pyramid through the given point, parallel to the two given lines.',
    },
  },
  solutionImageAlt: 'Expected solution illustration',
  help: {
    title: 'Stereometry',
    description:
      'Interactive 3D geometry game — construct auxiliary lines, find intersection points of lines and faces, and build cross-sections of solids.',
    controls: {
      drag: 'rotate the camera',
      shiftDrag: 'pan the view',
      scrollPinch: 'zoom in and out',
      clickEdge: 'select it',
      doubleClickEdge: 'extend edge into an infinite line (or remove it)',
      doubleClickLine: 'remove the line',
      dragVertex: 'draw a construction line between two points',
      selectEdgeTapVertex: 'draw a parallel line through that vertex',
    },
    controlLabels: {
      drag: 'Drag',
      shiftDrag: 'Shift+Drag',
      scrollPinch: 'Scroll / Pinch',
      clickEdge: 'Click edge/line',
      doubleClickEdge: 'Double-click edge',
      doubleClickLine: 'Double-click line',
      dragVertex: 'Drag vertex \u2192 vertex',
      selectEdgeTapVertex: 'Select edge/line + tap vertex',
    },
    intersectionHint: 'Intersection points appear automatically where lines cross.',
  },
} as const;
