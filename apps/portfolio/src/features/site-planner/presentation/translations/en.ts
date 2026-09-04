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
  structure: {
    title: 'Structure',
    boundary: 'Plot',
    house: 'House',
    addBuilding: 'New building',
    /** The add-building menu offers a preset per structure kind (R19). */
    presets: {
      house: 'House',
      shed: 'Shed',
      carport: 'Carport',
    },
    removeBuilding: 'Remove the building',
    /** New buildings are named «Строение N» until renamed. */
    newBuildingPrefix: 'Building',
    activeGroup: 'New shapes land here',
    /** The chip that marks the active list in the tree; the sentence above is its tooltip. */
    activeGroupShort: 'here',
    emptyBoundary: 'No shapes yet',
    emptyHouse: 'Pick this group and draw the footprint',
    union: 'Union',
    subtract: 'Subtract',
    moveUp: 'Move up',
    moveDown: 'Move down',
    /** The grip that drags a term into another place of the tree. */
    dragHandle: 'Drag to move',
    remove: 'Remove',
    /** Label of a nested composition; the count of its shapes follows. */
    group: 'Group',
    wrapInGroup: 'Wrap in a group',
    ungroup: 'Ungroup',
    removeGroup: 'Remove the group',
    /** Prefix of a circle radius in the term list. */
    radiusPrefix: 'R',
    trees: 'Trees',
    emptyTrees: 'Pick the placing tool (T) and click the plan to plant one',
    removeTree: 'Remove the tree',
    cars: 'Cars',
    emptyCars: 'Pick the placing tool (T), choose the car and click the plan',
    removeCar: 'Remove the car',
    paths: 'Paths',
    emptyPaths: 'Pick the path tool (P) and click out a line',
    removePath: 'Remove the path',
    /** Suffix of the number of points a path is drawn through. */
    pointCountSuffix: 'pts',
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
  electrical: {
    panelTitle: 'Electrical',
    toolLabel: 'Electrical',
    toolHint:
      'Outlets, switches and the panel hang on a wall by a click; a light goes on the ceiling.',
    connectLabel: 'Connect',
    connectHint:
      'The first click takes a device, the second wires the pair: panel + consumer makes a group, switch + light makes a link.',
    armedLabel: 'Places next',
    kinds: {
      panel: 'Panel',
      outlet: 'Outlet',
      switch: 'Switch',
      light: 'Light',
    },
    /** Centre of the device along its wall, from the wall's start. */
    offset: 'Along the wall',
    /** Mounting height above the floor — sockets 0.3, switches 0.9 by ПУЭ practice. */
    height: 'Height',
    groupsSummary: 'Groups',
    linksSummary: 'Links',
    remove: 'Remove the device',
    deviceHint: 'The device slides along its wall; Delete removes it with its wiring.',
    hint: 'The Connect tool (L) pulls the wires: panel to consumers, switches to lights.',
    emptyHint: 'Pick a device kind and click a wall — or the ceiling for a light.',
  },
  furniture: {
    panelTitle: 'Furniture',
    toolLabel: 'Furniture',
    toolHint: 'Click the plan to place the armed piece; near a wall it snaps back-to-wall.',
    furnitureGroup: 'Furniture',
    plumbingGroup: 'Plumbing',
    /** Height above the storey's floor — what hangs a boiler on a wall. */
    elevation: 'Above the floor',
    remove: 'Remove the piece',
    hint: 'Drag the piece — near a wall it turns its back to it (Alt suspends). The grip ahead turns it.',
    emptyHint: 'Pick a piece in the catalogue and click the plan.',
    items: {
      'bed-double': 'Double bed',
      'bed-160': 'Bed 160',
      'bed-single': 'Single bed',
      sofa: 'Sofa',
      armchair: 'Armchair',
      'armchair-wing': 'Wing chair',
      'office-chair': 'Office chair',
      table: 'Table',
      'table-round': 'Round table',
      'coffee-table': 'Coffee table',
      desk: 'Desk',
      chair: 'Chair',
      wardrobe: 'Wardrobe',
      'wardrobe-tall': 'Wardrobe 3-door',
      'wardrobe-sliding': 'Sliding wardrobe',
      dresser: 'Dresser',
      'dresser-wide': 'Wide dresser',
      'dresser-tall': 'Tall dresser',
      nightstand: 'Nightstand',
      'nightstand-tall': 'Tall nightstand',
      'tv-stand': 'TV stand',
      bookshelf: 'Bookshelf',
      'shelving-cube': 'Cube shelving',
      'kitchen-run': 'Kitchen run',
      fridge: 'Fridge',
      stove: 'Stove',
      sink: 'Sink',
      toilet: 'Toilet',
      shower: 'Shower',
      bathtub: 'Bathtub',
      'washing-machine': 'Washing machine',
      boiler: 'Boiler',
      radiator: 'Radiator',
    },
  },
  stairs: {
    panelTitle: 'Stairs',
    toolLabel: 'Stair',
    toolHint: 'Pick a stair kind and click the plan — it ties this storey to the one above.',
    menu: 'Choose the stair kind',
    /** The climb direction a floor plan states beside every stair. */
    up: 'UP',
    width: 'Flight width',
    steps: 'Steps',
    riser: 'Riser',
    tread: 'Tread',
    remove: 'Remove the stair',
    mirror: 'Mirror the stair',
    rotate: 'Turn a quarter',

    emptyHint: 'No stairs on this storey yet.',
    uncomfortable: 'Steps outside the comfortable bands',
    kinds: {
      straight: 'Straight',
      'l-shaped': 'Quarter turn',
      'u-shaped': 'Half turn',
      spiral: 'Spiral',
    },
  },
  slabs: {
    panelTitle: 'Floor slabs',
    toolLabel: 'Slab',
    toolHint:
      'Drag to draw a slab with the armed shape, or click to lay a 6 × 4 m one · its edges snap to the walls of the storey below · Alt suspends snapping',
    remove: 'Remove slab',
    rotate: 'Turn by 90°',
    emptyHint: 'No slabs on this storey — its outline still follows the walls.',
    kinds: {
      rectangle: 'Slab',
      circle: 'Round slab',
      ellipse: 'Oval slab',
    },
  },
  heating: {
    panelTitle: 'Stoves and fireplaces',
    toolLabel: 'Fireplace',
    toolHint:
      'Click the plan to stand a fireplace or a stove. Its flue rises on its own: through every storey above and out over the roof at the height the norm asks for.',
    menu: 'Choose the fire',
    kinds: {
      fireplace: 'Fireplace',
      stove: 'Stove',
      saunaStove: 'Sauna stove',
    },
    rotate: 'Turn by 90°',
    remove: 'Remove the fire',
    emptyHint: 'No fires on this storey.',
    flue: 'Flue',
    topAboveRoof: 'Top above the roof',
  },
  ventilation: {
    panelTitle: 'Ventilation',
    toolLabel: 'Vent shaft',
    toolHint:
      'Click the plan to stand a ventilation shaft. It passes through the floors above and comes out over the roof.',
    remove: 'Remove the shaft',
    emptyHint: 'No shafts on this storey. A wet room and a sauna each want one of their own.',
    kinds: {
      flue: 'Flue',
      vent: 'Vent shaft',
    },
    passingThrough: 'passes through',
    startsHere: 'starts here',
    top: 'Top',
  },
  supports: {
    panelTitle: 'Posts',
    toolLabel: 'Post',
    toolHint:
      'Click the plan — the post spans from the floor or the ground under it to the ceiling above.',
    remove: 'Remove the post',
    emptyHint: 'No posts on this storey yet.',
    length: 'Post length',
  },
  warnings: {
    panelTitle: 'Findings',
    empty: 'Nothing to look at.',
    furnitureOverStairwell: 'This piece stands over the stairwell — there is no floor under it.',
    wallOverStairwell: 'This wall crosses the stairwell — nothing carries it.',
    stairUncomfortable: 'Steps outside the comfortable bands: riser 15–19 cm, tread 25–30 cm.',
    /** Both quote the overhang, so the number is the argument. */
    cantileverUnsupported: (overhang: string) =>
      `A ${overhang} overhang with no post — ordinary framing carries about 0.6 m.`,
    cantileverEngineered: (overhang: string) =>
      `A ${overhang} overhang needs an engineered structure; ordinary joists will not span it.`,
    roomWithoutExhaust: (room: string) =>
      `${room}: no exhaust shaft inside the room — a wet or a fired room needs one of its own.`,
    saunaWithoutStove: 'The sauna has no stove — nothing heats the room.',
    ductOutsideRoof: 'The shaft stands off the roof outline — it has nowhere to come out.',
    roofTooFlat: (pitch: number) =>
      `A ${pitch}° roof does not shed: snow sits on it, and most coverings ask for 14° at least.`,
    storeyTooLow: (height: string) => `A ${height} storey is below the 2.2 m habitable minimum.`,
  },
  panelGroups: {
    tool: 'Tool',
    plot: 'Plot',
    structure: 'Structure',
    interior: 'Interior',
    services: 'Services',
    findings: 'Findings',
    properties: 'Properties',
  },
  storeys: {
    /** «Этаж N» caption of one storey button in the mode bar. */
    storeyTitle: 'Storey',
    add: 'Add a storey',
    addEmpty: 'Empty storey',
    addCopy: 'Copy the walls of the storey below',
    /** Chief Architect's reference display: the storey below ghosts through. */
    referenceToggle: 'Ghost the storey below',
    remove: 'Remove the storey',
    removeKicker: 'REMOVE',
    removeConfirmTitle: 'Remove the storey?',
    removeConfirmDescription:
      'Its walls, openings, furniture, wiring and the stairs climbing into it go with it. Ctrl+Z brings everything back.',
    removeConfirm: 'Remove the storey',
    removeCancel: 'Keep it',
    panelTitle: 'Storey',
    height: 'Storey height',
    floorLevel: 'Floor level',
    floorToFloor: 'Floor to floor',
    floorAboveGround: 'Floor above ground',
    floorLevelAbsolute: 'Absolute level',
  },
  roof: {
    pitchedTitle: 'Pitched roof',
    addPitched: 'Make it pitched',
    removePitched: 'Remove the pitched roof',
    kinds: {
      gable: 'Gable',
      hip: 'Hip',
      shed: 'Shed',
    },
    pitch: 'Pitch, °',
    overhang: 'Overhang',
    ridge: 'Ridge, °',
    ridgeHeight: 'Ridge above the eaves',
    flatHint:
      'The top is flat: a ceiling slab with roof zones over it. A pitched roof stands over the top storey.',
    panelTitle: 'Roof',
    /** «Зона N» caption of one exposed-ceiling region. */
    zoneTitle: 'Zone',
    covers: {
      membrane: 'Membrane',
      terrace: 'Terrace',
      green: 'Green roof',
    },
    emptyHint: 'Zones appear on the exposed ceiling — wherever no storey stands above.',
  },
  openings: {
    menu: 'Choose the opening kind',
    panelTitle: 'Openings',
    toolLabel: 'Opening',
    toolHint: 'Click a wall to hang the armed opening on it; drag one to slide it along.',
    /** What the opening tool places next. «Окно в пол» is a floor-sill window. */
    presetLabel: 'Places next',
    presets: {
      door: 'Door',
      window: 'Window',
      panoramic: 'Floor-to-ceiling window',
    },
    kinds: {
      door: 'Door',
      window: 'Window',
    },
    /** Centre of the opening along its wall, from the wall's start. */
    offset: 'Along the wall',
    width: 'Width',
    /** Bottom of the opening above the floor. */
    sill: 'Sill',
    /** Top of the opening above the floor. */
    head: 'Head',
    hint: 'The opening slides along its wall; Delete removes it.',
  },
  rooms: {
    panelTitle: 'Rooms',
    /** «Room N» caption of one derived region. */
    roomTitle: 'Room',
    /** The dropdown row that clears a room's type. */
    unassigned: '—',
    /** The badge a wet-zone room wears in the list. */
    wet: 'wet zone',
    emptyHint: 'Rooms appear once walls partition the footprint.',
    types: {
      living: 'Living room',
      bedroom: 'Bedroom',
      kitchen: 'Kitchen',
      bathroom: 'Bathroom',
      boiler: 'Boiler room',
      sauna: 'Sauna',
      garage: 'Garage',
      hall: 'Hall',
      dining: 'Dining room',
      wardrobe: 'Walk-in closet',
      laundry: 'Laundry',
      office: 'Office',
      pantry: 'Pantry',
      veranda: 'Veranda',
    },
  },
  walls: {
    panelTitle: 'Walls',
    wallTitle: 'Wall',
    toolLabel: 'Wall',
    toolHint: 'Click out the wall line; Enter or a double click finishes it.',
    traceOutline: 'Wall along the outline',
    traceOutlineHint:
      'A closed wall along the storey base in one press — on a round house that is the whole perimeter at once.',
    drawHint:
      'Click out the line; a click on the first point closes the ring. Enter or a double click finishes the wall, Esc cancels.',
    modifierHint:
      'Digits — exact segment length · Shift — 15° angle lock · Alt — suspend every snap (wall corners, base points, circle rim, grid). The cursor catches corners and circle quadrants by itself and glides along the rim.',
    junctionHint:
      'Junction selected, edges numbered. Digit — remove that edge · D + digit — tear the edge off the junction and carry it (a click plants it) · S — cut the wall in two here · Esc — deselect.',
    material: 'Material',
    materials: {
      brick: 'Brick masonry',
      'ceramic-block': 'Ceramic block',
      'foam-concrete': 'Foam concrete',
      timber: 'Timber',
      frame: 'Frame',
      glazing: 'Glazing',
    },
    thickness: 'Thickness',
    /** Which line the drawn polyline pins — see building-editor.md §4. */
    referenceLine: 'Reference line',
    referenceLines: {
      'outer-face': 'Outer face',
      centerline: 'Centreline',
    },
    remove: 'Remove the wall',
    /** The ring state read back, and the button that makes it. */
    contour: 'Contour',
    contourClosed: 'closed',
    closeRing: 'Close the contour',
    hint: 'Squares drag corners — an end dragged onto the other end closes the contour · rings add a corner · double click removes one · Alt+double click cuts the wall there · Delete removes the wall whole.',
    closedHint:
      'The contour is closed: the last corner joins the first. Alt+double click on a corner cuts the ring open there.',
    emptyHint:
      'No walls yet — the Wall tool (W) clicks them out along a reference line; a line clicked back onto its start closes into a contour.',
  },
  house: {
    title: 'Buildings',
    /** The building's editable name at the top of its block. */
    nameLabel: 'Building name',
    padModeLabel: 'Pad elevation',
    padModes: {
      'terrain-center': 'Terrain at the centre',
      'terrain-mean': 'Terrain average',
      'terrain-min': 'Terrain minimum',
      manual: 'Set by hand',
    },
    padElevation: 'Pad',
    padDrop: 'Lower by',
    wallHeight: 'Walls',
    earthworks: 'Earthworks',
    /** Soil taken away, where the pad sits below the ground. */
    cut: 'Cut',
    /** Soil brought in, where the pad sits above it. */
    fill: 'Fill',
    cubicMeterUnit: 'm³',
    foundation: {
      title: 'Foundation',
      kindLabel: 'Kind',
      kinds: {
        slab: 'Slab',
        'stem-wall': 'Stem wall',
        pier: 'Piers',
      },
      /** How far the foundation reaches below the pad. */
      depth: 'Depth',
      /** The цоколь — how far it stands above the pad. */
      plinth: 'Plinth',
      /** The concrete estimate line of the earthworks report. */
      volume: 'Concrete',
      /** Piers carry no estimate until their count is chosen. */
      volumeNotEstimated: '—',
    },
    entries: {
      title: 'Utility entries',
      add: 'Add an entry',
      editorHint:
        'Click selects an entry, Delete removes it. Dragged near the edge it rides the outline; carried into the footprint it goes through the foundation slab (gas stays on the facade). Indoor runs start from them, and site trenches snap onto them outside.',
      /** Position along the footprint outline, in metres from its start. */
      offset: 'Along outline',
      floorX: 'Through slab · X',
      floorY: 'Through slab · Y',
      throughFloor: 'through the slab',
      depth: 'Depth',
      /** A facade entry (gas) sits above ground rather than below it. */
      facadeHeight: 'Height',
      remove: 'Remove the entry',
      kinds: {
        sleeve: 'sleeve',
        facade: 'on the facade',
      },
      systems: {
        power: 'Electricity',
        network: 'Network',
        water: 'Water',
        sewer: 'Sewer',
        heating: 'Heating',
        ventilation: 'Ventilation',
        gas: 'Gas',
      },
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
  },
  status: {
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
} as const;
