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
      shortName: 'Two solids, one line',
      name: 'Line where two face planes meet',
      description:
        'A cube and a triangular prism stand on the same plane, with a point marking one face of each. Build the line along which the planes of those two faces meet.',
    },
    puzzle_2: {
      shortName: 'Trace of a plane',
      name: 'Trace of the cutting plane on the base',
      description:
        'Three points on the lateral edges of a square pyramid define a plane. Build the line along which that plane meets the plane of the base.',
    },
    puzzle_3: {
      shortName: 'Octahedron section',
      name: 'Pentagonal section of an octahedron',
      description:
        'Three points are marked on the edges of a regular octahedron. Build the section cut by the plane through them.',
    },
    puzzle_4: {
      shortName: 'Prism section',
      name: 'Pentagonal section of a hexagonal prism',
      description:
        'Three points are marked on the edges of a regular hexagonal prism. Build the section cut by the plane through them.',
    },
    puzzle_5: {
      shortName: 'Hexagon in a cube',
      name: 'Hexagonal section of a cube',
      description:
        'Three points lie on three edges of a cube. The plane through them crosses all six faces — build the whole section.',
    },
    puzzle_6: {
      shortName: 'Section parallel to a plane',
      name: 'Section parallel to a given plane',
      description:
        'Two segments sharing an endpoint span a plane. Build the section of the cuboid cut by the plane through the marked point parallel to that one.',
    },
    puzzle_7: {
      shortName: 'Pyramid section',
      name: 'Section of a pentagonal pyramid',
      description:
        'Construct a cross-section of the pyramid through the given point, parallel to the two given lines.',
    },
    puzzle_8: {
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
