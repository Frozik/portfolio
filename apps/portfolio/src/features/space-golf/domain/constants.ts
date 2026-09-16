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
export const GRAVITY_TURN_SECONDS = 0.3;
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

/**
 * A ball that covers less ground per step than this speed would while it
 * touches something is settling — rolling out, or held still by whatever
 * it is wedged against, whichever.
 */
export const REST_SPEED_METERS_PER_SECOND = 0.2;
export const REST_SETTLE_SECONDS = 0.3;

/** The ball must sit in the cup this long before the hole counts. */
export const CUP_HOLD_SECONDS = 1;
const CUP_TO_BALL_DIAMETER_RATIO = 2;
export const CUP_RADIUS_METERS = CUP_TO_BALL_DIAMETER_RATIO * BALL_RADIUS_METERS;

/** A spike tooth is a ball's diameter wide at the base and stands two diameters out of the face. */
export const SPIKE_WIDTH_METERS = 2 * BALL_RADIUS_METERS;
export const SPIKE_HEIGHT_METERS = 4 * BALL_RADIUS_METERS;
/** An obstacle that would move this close to the resting ball stays as it is when the stroke flips the board. */
export const FREEZE_CLEARANCE_METERS = 0.02;

/** A floating square is one ball diameter across when small and two when large (halved 2026-09-17 by feel). */
export const FLOATER_SMALL_SIDE_METERS = 2 * BALL_RADIUS_METERS;
export const FLOATER_LARGE_SIDE_METERS = 4 * BALL_RADIUS_METERS;
/** A floater's sides — and a rod's — give back a touch more than a wall does. */
export const FLOATER_RESTITUTION = 0.65;
const FLOATER_CLEARANCE_DIAMETERS = 10;
/** A floater's centre keeps this far from every wall face and from every other floater's centre. */
export const FLOATER_CLEARANCE_METERS = FLOATER_CLEARANCE_DIAMETERS * 2 * BALL_RADIUS_METERS;

/** A sliding rod is a ball's diameter thick, with a pointed tip half a diameter long that shoves a ball in its way aside. */
export const ROD_WIDTH_METERS = 2 * BALL_RADIUS_METERS;
export const ROD_TIP_METERS = BALL_RADIUS_METERS;
/** Fully out, the rod's tip has sunk this far into the face it bridges to. */
export const ROD_SEAT_DEPTH_METERS = ROD_TIP_METERS;
/** A rod slides out while gravity points its way and back in otherwise, at this speed. */
export const ROD_SPEED_METERS_PER_SECOND = 2;
/**
 * A rod that slides into the ball moves it out of the way step by step; of
 * its own speed it hands the ball only this share, so the ball is nudged
 * aside rather than kicked away.
 */
export const ROD_SHOVE_CARRY_SHARE = 0.3;
const ROD_MAX_LENGTH_DIAMETERS = 40;
/** A rod bridges the gap between two faces; the gap is at most this long, and at least long enough to be seen. */
export const ROD_MAX_LENGTH_METERS = ROD_MAX_LENGTH_DIAMETERS * 2 * BALL_RADIUS_METERS;
export const ROD_MIN_LENGTH_METERS = 0.6;

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
