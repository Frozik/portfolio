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
  nav: {
    backToPuzzlesLabel: 'Back to puzzles',
  },
  puzzles: {
    puzzle_1: {
      shortName: 'Pyramid section',
      name: 'Section of a pentagonal pyramid',
      description:
        'Construct a cross-section of the pyramid through the given point, parallel to the two given lines.',
    },
    puzzle_2: {
      shortName: 'Plane intersection',
      name: 'Intersection line of two planes (pentagonal prism)',
      description:
        'You are given a pentagonal prism and four segments forming two pairs of intersecting segments. Each pair defines a plane. Construct the line where the two planes intersect.',
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
      dragLineVertex: 'draw a parallel line through the vertex it is dropped on',
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
      dragLineVertex: 'Drag line \u2192 vertex',
    },
    intersectionHint: 'Intersection points appear automatically where lines cross.',
  },
} as const;
