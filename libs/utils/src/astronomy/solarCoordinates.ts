// Sun formulas ported from SunCalc 2.0.1 (BSD-2-Clause, see LICENSE-upstream.txt),
// after Meeus, "Astronomical Algorithms"; the chapter and formula numbers are his.
// The same series, with worked values, are published in NOAA's solar calculator
// notes: https://gml.noaa.gov/grad/solcalc/calcdetails.html
import { Temporal } from 'temporal-polyfill';

import { MS_PER_DAY, SECONDS_PER_DAY } from '../date/constants';

const HALF_TURN_DEGREES = 180;
const FULL_TURN_DEGREES = 2 * HALF_TURN_DEGREES;

export const DEGREES_TO_RADIANS = Math.PI / HALF_TURN_DEGREES;
export const ARCMINUTES_PER_DEGREE = 60;
export const ARCSECONDS_PER_ARCMINUTE = 60;
export const ARCSECONDS_PER_DEGREE = ARCMINUTES_PER_DEGREE * ARCSECONDS_PER_ARCMINUTE;

/** Julian days begin at noon, half a day after the civil days the epoch counts. */
const NOON_OFFSET_DAYS = 0.5;
const JULIAN_DAY_OF_UNIX_EPOCH = 2_440_588;
const JULIAN_DAY_OF_J2000 = 2_451_545;
const DAYS_PER_JULIAN_CENTURY = 36_525;
const DAYS_PER_GREGORIAN_YEAR = 365.2425;
const J2000_YEAR = 2000;

/** Days since J2000.0 (2000-01-01 12:00 UT), the epoch every series below counts from. */
export function daysSinceJ2000(instant: Temporal.Instant): number {
  return (
    instant.epochMilliseconds / MS_PER_DAY -
    NOON_OFFSET_DAYS +
    JULIAN_DAY_OF_UNIX_EPOCH -
    JULIAN_DAY_OF_J2000
  );
}

export function instantAtDaysSinceJ2000(days: number): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(
    Math.round(
      (days + JULIAN_DAY_OF_J2000 + NOON_OFFSET_DAYS - JULIAN_DAY_OF_UNIX_EPOCH) * MS_PER_DAY
    )
  );
}

/** c₀ + c₁x + c₂x² + … — every series in this module is one of these. */
function evaluatePolynomial(x: number, coefficients: readonly number[]): number {
  return coefficients.reduceRight((sum, coefficient) => sum * x + coefficient, 0);
}

/**
 * ΔT = TT − UT: the Espenak & Meeus polynomial fits, one per era, each a
 * polynomial in years past its own base year; good for about 1900–2150.
 * Published by NASA: https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html
 */
interface DeltaTFit {
  readonly untilYear: number;
  readonly baseYear: number;
  readonly coefficientsSeconds: readonly number[];
}

const DELTA_T_FITS: readonly DeltaTFit[] = [
  {
    untilYear: 1920,
    baseYear: 1900,
    coefficientsSeconds: [-2.79, 1.494119, -0.0598939, 0.0061966, -0.000197],
  },
  { untilYear: 1941, baseYear: 1920, coefficientsSeconds: [21.2, 0.84493, -0.0761, 0.0020936] },
  { untilYear: 1961, baseYear: 1950, coefficientsSeconds: [29.07, 0.407, -1 / 233, 1 / 2547] },
  { untilYear: 1986, baseYear: 1975, coefficientsSeconds: [45.45, 1.067, -1 / 260, -1 / 718] },
  {
    untilYear: 2005,
    baseYear: 2000,
    coefficientsSeconds: [63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599],
  },
  { untilYear: 2050, baseYear: 2000, coefficientsSeconds: [62.92, 0.32217, 0.005589] },
];

/** Past the last fit: the long-term parabola, in centuries from 1820, less a linear trim to 2150. */
const LONG_TERM_BASE_YEAR = 1820;
const LONG_TERM_TRIM_YEAR = 2150;
const YEARS_PER_CENTURY = 100;
const LONG_TERM_OFFSET_SECONDS = -20;
const LONG_TERM_PARABOLA_SECONDS_PER_CENTURY_SQUARED = 32;
const LONG_TERM_TRIM_SECONDS_PER_YEAR = 0.5628;

/**
 * The position series are defined in Terrestrial Time while civil instants
 * are UT; ΔT is ~69 s today, below 0.001° for the Sun. The decimal year is
 * derived from the day count, which is accurate to the month this needs.
 */
function deltaTSeconds(daysUt: number): number {
  const year = J2000_YEAR + daysUt / DAYS_PER_GREGORIAN_YEAR;
  const fit = DELTA_T_FITS.find(candidate => year < candidate.untilYear);

  if (fit !== undefined) {
    return evaluatePolynomial(year - fit.baseYear, fit.coefficientsSeconds);
  }

  const centuries = (year - LONG_TERM_BASE_YEAR) / YEARS_PER_CENTURY;

  return (
    LONG_TERM_OFFSET_SECONDS +
    LONG_TERM_PARABOLA_SECONDS_PER_CENTURY_SQUARED * centuries * centuries -
    LONG_TERM_TRIM_SECONDS_PER_YEAR * (LONG_TERM_TRIM_YEAR - year)
  );
}

/** The same day count on the Terrestrial Time scale the position series run on. */
export function toTerrestrialDays(daysUt: number): number {
  return daysUt + deltaTSeconds(daysUt) / SECONDS_PER_DAY;
}

export interface EquatorialCoordinates {
  readonly rightAscensionRadians: number;
  readonly declinationRadians: number;
}

/** Meeus 25.2: the Sun's geometric mean longitude, degrees, in Julian centuries since J2000. */
const MEAN_LONGITUDE_DEGREES = [280.46646, 36000.76983, 0.0003032] as const;
/** Meeus 25.3: the Sun's mean anomaly, degrees. */
const MEAN_ANOMALY_DEGREES = [357.52911, 35999.05029, -0.0001537] as const;
/** Meeus 25.4, the equation of the centre: the sin M, sin 2M and sin 3M amplitudes, degrees. */
const CENTRE_SIN_M_DEGREES = [1.914602, -0.004817, -0.000014] as const;
const CENTRE_SIN_2M_DEGREES = [0.019993, -0.000101] as const;
const CENTRE_SIN_3M_DEGREES = 0.000289;
/** The longitude of the Moon's ascending node, degrees — what nutation and the obliquity swing with. */
const ASCENDING_NODE_DEGREES = [125.04, -1934.136] as const;
/** Meeus 25.8: aberration plus nutation in longitude, degrees. */
const APPARENT_LONGITUDE_OFFSET_DEGREES = 0.00569;
const APPARENT_LONGITUDE_NUTATION_DEGREES = 0.00478;
/** Meeus 22.2: the mean obliquity of the ecliptic, degrees. */
const MEAN_OBLIQUITY_DEGREES = [23.439291, -0.0130042, -0.00000016, 0.000000504] as const;
/** Meeus 25.8: the obliquity correction for the apparent position, degrees. */
const OBLIQUITY_NUTATION_DEGREES = 0.00256;

/** The Sun's apparent equatorial coordinates, Meeus ch. 25, from days since J2000 in TT. */
export function sunEquatorialCoordinates(daysTt: number): EquatorialCoordinates {
  const t = daysTt / DAYS_PER_JULIAN_CENTURY;
  const meanLongitude = DEGREES_TO_RADIANS * evaluatePolynomial(t, MEAN_LONGITUDE_DEGREES);
  const meanAnomaly = DEGREES_TO_RADIANS * evaluatePolynomial(t, MEAN_ANOMALY_DEGREES);
  const equationOfCentre =
    DEGREES_TO_RADIANS *
    (evaluatePolynomial(t, CENTRE_SIN_M_DEGREES) * Math.sin(meanAnomaly) +
      evaluatePolynomial(t, CENTRE_SIN_2M_DEGREES) * Math.sin(2 * meanAnomaly) +
      CENTRE_SIN_3M_DEGREES * Math.sin(3 * meanAnomaly));
  const ascendingNode = DEGREES_TO_RADIANS * evaluatePolynomial(t, ASCENDING_NODE_DEGREES);
  const apparentLongitude =
    meanLongitude +
    equationOfCentre -
    DEGREES_TO_RADIANS *
      (APPARENT_LONGITUDE_OFFSET_DEGREES +
        APPARENT_LONGITUDE_NUTATION_DEGREES * Math.sin(ascendingNode));
  const obliquity =
    DEGREES_TO_RADIANS *
    (evaluatePolynomial(t, MEAN_OBLIQUITY_DEGREES) +
      OBLIQUITY_NUTATION_DEGREES * Math.cos(ascendingNode));

  return {
    // 25.6 and 25.7
    rightAscensionRadians: Math.atan2(
      Math.cos(obliquity) * Math.sin(apparentLongitude),
      Math.cos(apparentLongitude)
    ),
    declinationRadians: Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude)),
  };
}

/**
 * Meeus 12.4: Greenwich mean sidereal time, degrees per day since J2000 (the
 * T² and T³ terms dropped); the USNO gives the same approximation at
 * https://aa.usno.navy.mil/faq/GAST.
 */
const SIDEREAL_TIME_DEGREES = [280.46061837, 360.98564736629] as const;

export function localSiderealTime(daysUt: number, westLongitudeRadians: number): number {
  return (
    DEGREES_TO_RADIANS * evaluatePolynomial(daysUt, SIDEREAL_TIME_DEGREES) - westLongitudeRadians
  );
}

export function altitudeRadians(
  hourAngle: number,
  latitudeRadians: number,
  declinationRadians: number
): number {
  return Math.asin(
    Math.sin(latitudeRadians) * Math.sin(declinationRadians) +
      Math.cos(latitudeRadians) * Math.cos(declinationRadians) * Math.cos(hourAngle)
  );
}

/** North-based clockwise azimuth in degrees: 0 north, 90 east, 180 south, 270 west. */
export function azimuthDegrees(
  hourAngle: number,
  latitudeRadians: number,
  declinationRadians: number
): number {
  const southBased =
    Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latitudeRadians) -
        Math.tan(declinationRadians) * Math.cos(latitudeRadians)
    ) / DEGREES_TO_RADIANS;

  return (southBased + FULL_TURN_DEGREES + HALF_TURN_DEGREES) % FULL_TURN_DEGREES;
}

/**
 * Meeus 16.4 (Sæmundsson's formula): R = 1.02′ / tan(h + 10.26° / (h + 5.10°)),
 * h the true altitude in degrees. See
 * https://en.wikipedia.org/wiki/Atmospheric_refraction#Calculating_refraction
 */
const REFRACTION_ARCMINUTES = 1.02;
const REFRACTION_TANGENT_SHIFT_DEGREES = 10.26;
const REFRACTION_ALTITUDE_SHIFT_DEGREES = 5.1;
/** The same formula with every term in radians, so it applies straight to the altitude. */
const REFRACTION_RADIANS = (REFRACTION_ARCMINUTES / ARCMINUTES_PER_DEGREE) * DEGREES_TO_RADIANS;
const REFRACTION_TANGENT_SHIFT_RADIANS =
  REFRACTION_TANGENT_SHIFT_DEGREES * DEGREES_TO_RADIANS * DEGREES_TO_RADIANS;
const REFRACTION_ALTITUDE_SHIFT_RADIANS = REFRACTION_ALTITUDE_SHIFT_DEGREES * DEGREES_TO_RADIANS;

/** How much higher the atmosphere makes a body look; the formula holds for positive altitudes only. */
export function atmosphericRefractionRadians(altitude: number): number {
  const clamped = Math.max(altitude, 0);

  return (
    REFRACTION_RADIANS /
    Math.tan(
      clamped + REFRACTION_TANGENT_SHIFT_RADIANS / (clamped + REFRACTION_ALTITUDE_SHIFT_RADIANS)
    )
  );
}

/** Wraps an angle into (−π, π]. */
export function wrapToHalfTurn(angle: number): number {
  return angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
}
