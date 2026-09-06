import { sitePlannerHouseTranslationsEn } from './en-house';
import { sitePlannerInteriorTranslationsEn } from './en-interior';
export const sitePlannerTranslationsEn = {
  title: 'Site Planner',
  viewMode: {
    groupLabel: 'View mode',
    plan: 'Plan',
    scene: '3D',
  },
  plan: {
    canvasLabel: 'Site plan',
    /** Unit suffix of every metre readout drawn on the plan. */
    meterUnit: 'm',
    /** Compass needle caption, on the plan and over the 3D view alike. */
    northLabel: 'N',
    /** Prefix of the pad elevation captioned on the building footprint. */
    padLabelPrefix: 'pad',
    /** Area unit of the derived rooms' captions. */
    squareMeterUnit: 'm²',
    /** One letter per system, worn by the utility-entry badges on the outline. */
    entryLetters: {
      power: 'E',
      network: 'N',
      water: 'W',
      sewer: 'S',
      heating: 'H',
      ventilation: 'V',
      gas: 'G',
    },
  },
  scene: {
    canvasLabel: '3D view of the site',
    resetCamera: 'Frame the plot again',
    /** Accessible name of the compass turning with the camera. */
    compass: 'Where north lies',
    /** Status-bar line of the 3D view. */
    navigationHint:
      'Drag to orbit · right button, two fingers or Shift+drag to pan · wheel or pinch to zoom · Tab returns to the plan',
  },
  sun: {
    /** The ☀ toolbar button, and the label of the bar it opens. */
    toggle: 'Sun and shadows',
    title: 'Sun study',
    date: 'Date',
    time: 'Time of day',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    playDay: 'Play the day',
    pauseDay: 'Pause',
  },
  analysis: {
    /** The overlay segment of the toolbar. */
    groupLabel: 'Overlay',
    none: 'None',
    slope: 'Slope',
    cutFill: 'Cut/Fill',
    /** Caption of the legend floating over the canvas. */
    legendTitle: 'Legend',
    slopeSteps: {
      gentle: 'Level enough to build on',
      moderate: 'Needs grading',
      steep: 'Needs terracing',
    },
    /** Shown in place of the cut/fill legend while the plan has no house. */
    noHouse: 'Draw a building footprint to see its earthworks',
  },
  tools: {
    groupLabel: 'Tools',
    select: 'Select',
    /** The hand: drags the sheet itself, never anything on it. */
    pan: 'Pan',
    rectangle: 'Rectangle',
    circle: 'Circle',
    ellipse: 'Ellipse',
    elevation: 'Elevation mark',
    /** The tool that places whatever its button is armed with: a tree, or a car. */
    tree: 'Place object',
    path: 'Path',
    /** The tool that routes the trench of whatever system its button is armed with. */
    utility: 'Utility line',
    measure: 'Measure',
    /** Accessible name of the triangle that opens a tool button's flyout. */
    shapeMenu: 'Choose the shape to draw',
    placedObjectMenu: 'Choose the object to place',
    utilityMenu: 'Choose the system to route',
    furnitureMenu: 'Choose the piece to place',
    electricMenu: 'Choose the device to place',
    /** Header of the utility flyout's one run. */
    systemGroup: 'Systems',
    /** Headers of the object flyout, one run of it apiece. */
    treeGroup: 'Trees',
    carGroup: 'Cars',
  },
  modes: {
    /** The mode chip names the edited object: «{name} — {suffix}». */
    siteName: 'Site',
    /** A path has no name of its own; the chip numbers it: «Path 2». */
    pathName: 'Path',
    /** A trench is numbered the same way: «Utility line 2». */
    routeName: 'Utility line',
    editRoute: 'Edit the line',
    editingSuffix: 'editing',
    /** The one obvious way out of a mode, for whoever knows no Esc yet. */
    done: 'Done',
    editPath: 'Edit the path',
    editSite: 'Edit the site',
    /** The building door in the rail: site editing, aimed at the house group. */
    editHouse: 'Building — add or change the house',
    siteCardHint:
      'Shapes, the house and the elevation marks are edited inside the site editor. A double-click on the plot opens it too.',
  },
  segments: {
    panelTitle: 'Segments',
    /** «Segment N» caption of one stretch between two bends. */
    title: 'Segment',
    surfaceLabel: 'Paving',
    surfaces: {
      dirt: 'Dirt',
      asphalt: 'Asphalt',
    },
    /** The ribbon's width where the segment begins / ends — the shared points. */
    startWidth: 'Width at start',
    endWidth: 'Width at end',
    hint: 'Neighbouring segments share their bend, so a width edited here moves in both rows.',
  },
  stockHouses: {
    title: 'Stock houses',
    menu: 'Building menu',
    storeysFact: 'Storeys',
    roomsFact: 'Rooms',
    menuItem: 'Add a stock house…',
    place: 'Place on the plot',
    fromFile: 'From a file…',
    hint: 'The house lands furnished, wired, with utility entries and a roof — from there it is edited like any other. A file is a building saved from another plan.',
    fileIssue: 'That file is not a saved building — it takes JSON exported from this planner.',
  },
  objects: {
    title: 'Objects',
    buildings: 'Buildings',
    emptyBuildings: 'Add a building — a stock house comes with its utility entries.',
    storeySuffix: 'fl.',
    clear: 'Clear the plot',
    clearTitle: 'Clear the plot?',
    clearDescription:
      'Every building, tree, car, path and trench will be removed. The boundary, elevation marks and settings stay. One Ctrl+Z undoes it.',
    clearConfirm: 'Clear',
    clearCancel: 'Cancel',
  },
  marks: {
    title: 'Elevation marks',
    empty: 'Pick the elevation tool (E) and click the plan to survey a point',
    remove: 'Remove the mark',
    /** Caption of the field that floats by a freshly placed flag. */
    elevationInputLabel: 'Mark elevation',
    pasteCsv: 'Paste from CSV',
    csv: {
      kicker: 'CSV',
      title: 'Paste elevation marks',
      description:
        'One mark per line: easting, northing and elevation in metres. Commas, semicolons, tabs and spaces all separate.',
      placeholder: '12.5; 8.0; 1.25',
      /** Prefix of the count of rows that were read. */
      parsed: 'Marks recognised:',
      /** Prefix of the numbers of the rows that were not. */
      skippedLines: 'Lines skipped:',
      submit: 'Add marks',
      cancel: 'Cancel',
    },
  },
  properties: {
    toolTitle: 'Tool',
    title: 'Properties',
    centerX: 'X',
    centerY: 'Y',
    width: 'Width',
    length: 'Length',
    rotation: 'Rotation',
    radius: 'Radius',
    elevation: 'Elevation',
    /** Radius of a tree's crown, the circle the plan draws for it. */
    crownRadius: 'Crown',
    treeHeight: 'Height',
    speciesLabel: 'Species',
    species: {
      spruce: 'Spruce',
      pine: 'Pine',
      thuja: 'Thuja',
      deciduous: 'Broadleaf',
    },
    /** The car, in the tool flyout and in the structure list alike. */
    car: 'Car',
    /** What the placing tool is armed with, reported while nothing is selected. */
    placingLabel: 'Ready to place',
    placingHint:
      'Click the plan to place it. The arrow on the tool button switches the object; cars are turned by the grip at the nose.',
    /** Shown when the ribbon varies and the single width field would overwrite it. */
    mixedWidthHint: 'The points carry different widths — this field sets one width for them all.',
    /** How a selected path's polyline is reshaped point by point. */
    pathPointsHint:
      'The squares are the path points — drag them. The ring in the middle of a segment adds a point; double-click a point to remove it.',
    /** «Point N / M» header of the opened path point. */
    pathPointLabel: 'Point',
    pathPointHint: 'X and Y move this point; width is how wide the ribbon runs through it.',
    /** View mode's lighter kit: moving points only, the rest is behind the editor. */
    pathViewHint:
      'Drag the squares to move points. Adding and removing points and per-point widths live in the path editor.',
    /** A whole structure selected in view mode. */
    buildingHint:
      'Drag to move the whole building. Its shapes, pad and walls are edited inside the site editor.',
    empty: 'Nothing selected',
    /** How a selected group joins the fold that holds it. */
    groupOperation: 'Operation',
    groupShapeCount: 'Shapes inside',
    groupHint:
      'The terms of a group are folded on their own first, and the result joins the fold around it with this operation.',
  },
  compass: {
    title: 'Compass',
    /** Accessible name of the dial the needle is dragged round. */
    dial: 'Direction of north',
    /** The exact bearing, in degrees; the field beside the dial. */
    azimuth: 'Azimuth',
    /** Puts the plot back on a plan drawn to true north. */
    resetToNorthUp: 'North up',
    hint: 'Turns where north lies, not the plot. Shift snaps to 15°, Alt turns freely.',
    /** The rose on the dial; single letters, as on a drawing. */
    cardinals: {
      north: 'N',
      east: 'E',
      south: 'S',
      west: 'W',
    },
  },
  utilities: {
    /** The СЕТИ side-panel card. */
    title: 'Utilities',
    empty:
      'Route utility lines with the trench tool (N) — depth, slope and digging derive from each system’s code',
    systems: {
      power: 'Electricity',
      network: 'Network',
      water: 'Water',
      sewer: 'Sewer',
      heating: 'Heating',
      ventilation: 'Ventilation',
      gas: 'Gas',
    },
    systemLabel: 'System',
    /** The sewer pipe's bore, what its slope rule reads. */
    diameter: 'Pipe bore',
    length: 'Length',
    /** The derived burial range along the run: «0.8–1.4 m». */
    depthRange: 'Depth',
    /** The gravity fall of a sewer run, as «2 cm/m». */
    slope: 'Slope',
    slopeUnit: 'cm/m',
    remove: 'Remove the line',
    /** The earthworks line all the trenches add up to. */
    trenchVolume: 'Trench digging',
    warningsTitle: 'Code findings',
    /** Composed as «{system} — {finding}: {actual} m (norm {required} m)». */
    warnings: {
      shallowDepth: 'rises above its code burial',
      driveableCover: 'thin cover under paving',
      parallelSeparation: 'too close to a parallel line',
    },
    normPrefix: 'norm',
    /** Shown while the trench editor is open. */
    pointsHint:
      'Drag a square to move a bend — near its entry it snaps onto it · drag a ring to add one · double click removes a bend · double click on emptiness leaves',
    /** СП 62.13330 puts gas design with a licensed organization; always shown. */
    gasDisclaimer: 'Gas supply is designed by a licensed organization; this plan is a sketch.',
  },
  settings: {
    /** The ⚙ toolbar button, and the label of the drawer it opens. */
    toggle: 'Settings',
    title: 'Plan settings',
    grid: {
      title: 'Grid',
      step: 'Step',
      snap: 'Snap to the grid',
    },
    terrain: {
      title: 'Plot and terrain',
      setback: 'Setback',
      contourInterval: 'Contours',
      resolution: 'Terrain grid',
      /** What every burial norm measures from (СП 22.13330). */
      frostDepth: 'Frost depth',
    },
    location: {
      title: 'Location',
      latitude: 'Latitude',
      longitude: 'Longitude',
      timeZone: 'Zone',
      unknownTimeZone: 'No time zone goes by that name',
      /** Rotation of the plan's north away from geographic north. */
      pickOnMap: 'Pick on the map',
      mapHint: 'A map is quicker than a latitude, and it brings the time zone with it.',
      map: {
        kicker: 'OpenStreetMap',
        title: 'The plot on the map',
        description:
          'Click the map to move the pin, or drag it. Applying writes the coordinates and the time zone they fall in.',
        /** Names the pin for a screen reader and for its hover tooltip. */
        marker: 'Plot location',
        apply: 'Apply',
        cancel: 'Cancel',
      },
    },
    layers: {
      title: 'Visible layers',
      kinds: {
        grid: 'Grid',
        contours: 'Contour lines',
        setback: 'Setback line',
        dimensions: 'Dimensions',
        analysis: 'Analysis overlay',
        marks: 'Elevation marks',
        trees: 'Trees',
        paths: 'Paths',
      },
    },
  },
  file: {
    /** The ⬇ toolbar button, and the label of the menu it opens. */
    menu: 'Export and import',
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    exportPng: 'Export PNG',
    dismissIssue: 'Dismiss',
    issues: {
      'import-failed': 'This file is not a site plan this version can read',
      'export-failed': 'The plan image could not be produced',
    },
  },
  panels: {
    /** Opens the editor panels on a screen too narrow to stand them beside the plan. */
    toggle: 'Panels',
    title: 'Plan panels',
  },
  history: {
    undo: 'Undo',
    redo: 'Redo',
    /** Hotkey shown next to the action in the toolbar tooltip. */
    undoHotkey: 'Ctrl+Z',
    redoHotkey: 'Ctrl+Y',
  },
  save: {
    label: 'Saved state',
    saved: 'saved',
    saving: 'saving…',
    error: 'not saved',
    blocked: 'not saved — storage holds a plan this build cannot read',
  },
  status: {
    carModelUnavailable: 'car model unavailable, a stand-in is drawn',
    grid: 'Grid',
    zoom: 'Zoom',
    /** Stands in for the cursor position while the pointer is off the canvas. */
    unknownValue: '—',
    hints: {
      select:
        'Drag to move · handles resize and rotate · Shift on the ⌖ mark moves the anchor · Shift while moving snaps to other shapes · Alt suspends snapping',
      pan: 'Drag to move the canvas · Space+drag and the wheel pan and zoom in every tool',
      rectangle: 'Drag to draw a rectangle · Shift snaps its first corner to other shapes',
      circle: 'Drag out from the centre to draw a circle · Shift snaps the centre to other shapes',
      ellipse: 'Drag to draw an ellipse · Shift snaps its first corner to other shapes',
      elevation:
        'Click to place a mark and type its elevation · drag a flag to move it · Delete removes',
      tree: 'Click to place the armed object · drag to move it · the grip at a car’s nose turns it · Delete removes',
      path: 'Click to add a point · Enter or double click finishes · Esc cancels',
      utility:
        'Click to route the armed system’s line · a click near its entry lands on it · Enter or double click finishes · Esc cancels',
      measure: 'Click two points to measure · Esc clears',
    },
  },
  ...sitePlannerInteriorTranslationsEn,
  ...sitePlannerHouseTranslationsEn,
} as const;
