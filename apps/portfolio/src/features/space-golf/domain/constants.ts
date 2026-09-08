/** The board is portrait, like the reference: 9 × 16 metres, one cell = one metre. */
export const BOARD_WIDTH_METERS = 9;
export const BOARD_HEIGHT_METERS = 16;

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

/** Recorded: plain faces give back 0.3–0.5 of the normal speed, the thick gold bars ≈ 0.75. */
export const FLOOR_RESTITUTION = 0.45;
export const DEFLECTOR_RESTITUTION = 0.75;
export const BOUNCE_RESTITUTION = 0.75;
/** Share of the tangential speed kept on an impact (recorded ≈ 0.5). */
export const CONTACT_FRICTION = 0.55;
/** Rolling friction while in contact with the floor, per second. */
export const ROLLING_DAMPING_PER_SECOND = 0.8;
/** Drag in flight, per second: keeps the speed a wall hit leaves along the wall from lasting forever. */
export const AIR_DAMPING_PER_SECOND = 0.25;
/** A normal speed under this at contact does not bounce back: the ball stays on the face. */
export const MIN_BOUNCE_SPEED_METERS_PER_SECOND = 0.8;

/** An elastic face gives back even a soft touch, so the ball does not lie on a bar as on a floor. */
export const ELASTIC_MIN_BOUNCE_SPEED_METERS_PER_SECOND = 0.25;

export const REST_SPEED_METERS_PER_SECOND = 0.2;
export const REST_SETTLE_SECONDS = 0.3;
/** The ball must sit in the cup this long before the hole counts. */
export const CUP_HOLD_SECONDS = 1;

/** The board is open: a ball that has left it for this long bursts and comes back to its rest point. */
export const OFFSCREEN_LIMIT_SECONDS = 3;

export const SPIKE_HEIGHT_METERS = 0.12;
export const PICKUP_RADIUS_METERS = 0.16;
/** The ring drawn round the ball while the band is held. */
export const AIM_RING_RADIUS_METERS = 0.9;

export const PREVIEW_DOT_COUNT = 5;
export const PREVIEW_INTERVAL_SECONDS = 0.05;

/** Contact tolerance: the ball is kept this far off a face so the next sweep does not start inside it. */
export const CONTACT_EPSILON_METERS = 1e-4;
