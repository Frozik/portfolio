export const stereometryTranslationsEn = {
  toolbar: {
    undo: 'Undo',
    redo: 'Redo',
    rotate: 'Rotate',
    pan: 'Pan',
    help: 'Help',
    close: 'Close',
  },
  help: {
    title: 'Stereometry',
    description:
      'Interactive 3D geometry game — construct auxiliary lines, find intersection points of lines and faces, and build cross-sections of solids.',
    controls: {
      drag: 'rotate the camera',
      shiftDrag: 'pan the view',
      scrollPinch: 'zoom in and out',
      clickEdge: 'select it',
      doubleClickEdge: 'extend edge into an infinite line',
      dragVertex: 'draw a construction line between two points',
      selectEdgeTapVertex: 'draw a parallel line through that vertex',
    },
    controlLabels: {
      drag: 'Drag',
      shiftDrag: 'Shift+Drag',
      scrollPinch: 'Scroll / Pinch',
      clickEdge: 'Click edge/line',
      doubleClickEdge: 'Double-click edge',
      dragVertex: 'Drag vertex \u2192 vertex',
      selectEdgeTapVertex: 'Select edge/line + tap vertex',
    },
    intersectionHint: 'Intersection points appear automatically where lines cross.',
  },
} as const;
