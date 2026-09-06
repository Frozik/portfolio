export const sitePlannerHouseTranslationsEn = {
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
    /** Which line the drawn polyline pins. */
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
} as const;
