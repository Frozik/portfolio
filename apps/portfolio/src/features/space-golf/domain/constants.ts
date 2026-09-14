/** The board is portrait, like the reference: 9 × 16 metres. */
export const BOARD_WIDTH_METERS = 9;
export const BOARD_HEIGHT_METERS = 16;
/** The layout grid: islands are built from half-metre cells, so the board reads fine-grained next to the ball. */
export const CELL_METERS = 0.5;

/**
 * Measured on a recording of the original (arena width taken as 9 m):
 * gravity ≈ 275 px/s² of a 363 px arena → 6.8 m/s²; the ball ≈ 5 px across
 * → radius 0.06 m; the fastest recorded flight ≈ 9.3 m/s.
 */
export const BALL_RADIUS_METERS = 0.07;
export const GRAVITY_METERS_PER_SECOND_SQUARED = 7;
/** Two sub-steps per 60 Hz frame; the preview and the flight run the very same steps. */
export const FIXED_STEP_SECONDS = 1 / 120;
/** How many contacts one step may resolve before the remainder is dropped. */
export const MAX_CONTACTS_PER_STEP = 4;

export const MAX_SPEED_METERS_PER_SECOND = 10;
/** Metres per second of launch speed per metre of band stretch. */
export const BAND_SPEED_PER_METER = 5;
/** A pull shorter than this is a slack band: no dots, no stroke. */
export const AIM_DEAD_ZONE_METERS = 0.15;

/** Share of the normal speed a wall gives back, flat or diagonal alike (recorded 0.3–0.5 on faces and corners). */
export const WALL_RESTITUTION = 0.55;
/** An elastic surface springs back like the recording's thick gold bars (≈ 0.75) and then some. */
export const BOUNCE_RESTITUTION = 0.8;
/** A viscous surface swallows the impact: the recording's sticky diamond kept 6 % of the normal speed. */
export const STICKY_RESTITUTION = 0.06;
/** Share of the tangential speed kept on an impact (recorded ≈ 0.5). */
export const CONTACT_FRICTION = 0.55;
/** A viscous surface grabs the ball along the face too. */
export const STICKY_CONTACT_FRICTION = 0.15;
/**
 * Rolling resistance while in contact with the floor: a constant
 * deceleration, so the ball stops in finite time rather than creeping —
 * a 1 m/s roll ends after 0.25 m, a 3 m/s one after 2.25 m.
 */
export const ROLLING_RESISTANCE_METERS_PER_SECOND_SQUARED = 2;
/** On a viscous surface the ball creeps to a stop. */
export const STICKY_ROLLING_RESISTANCE_METERS_PER_SECOND_SQUARED = 8;
/** Drag in flight, per second: keeps the speed a wall hit leaves along the wall from lasting forever. */
export const AIR_DAMPING_PER_SECOND = 0.25;
/** A normal speed under this at contact does not bounce back: the ball stays on the face. */
export const MIN_BOUNCE_SPEED_METERS_PER_SECOND = 0.8;
/** An elastic surface gives back even a soft touch, so the ball hops a while before it lies still. */
export const ELASTIC_MIN_BOUNCE_SPEED_METERS_PER_SECOND = 0.25;

export const REST_SPEED_METERS_PER_SECOND = 0.2;
export const REST_SETTLE_SECONDS = 0.3;

/** The ball must sit in the cup this long before the hole counts. */
export const CUP_HOLD_SECONDS = 1;
export const CUP_RADIUS_METERS = 0.2;

/**
 * The board is open: a ball that leaves it and would not be back within this
 * long bursts the moment it leaves, and comes back to its rest point.
 */
export const OFFSCREEN_LIMIT_SECONDS = 3;

/** The ring drawn round the ball while the band is held. */
export const AIM_RING_RADIUS_METERS = 0.9;

export const PREVIEW_DOT_COUNT = 5;
export const PREVIEW_INTERVAL_SECONDS = 0.05;

/** Contact tolerance: the ball is kept this far off a face so the next sweep does not start inside it. */
export const CONTACT_EPSILON_METERS = 1e-4;
