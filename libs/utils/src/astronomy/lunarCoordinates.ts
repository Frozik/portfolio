// Moon formulas ported from SunCalc 2.0.1 (BSD-2-Clause, see LICENSE-upstream.txt),
// after Meeus, "Astronomical Algorithms" ch. 47 — the truncated ELP-2000/82 series.
import { ARCSECONDS_PER_DEGREE, DEGREES_TO_RADIANS } from './solarCoordinates';

const DAYS_PER_JULIAN_CENTURY = 36_525;
/** The periodic terms are tabulated in millionths of a degree and thousandths of a kilometre. */
const MICRODEGREES_PER_DEGREE = 1e6;
const METERS_PER_KILOMETER = 1000;
/** The mean Earth–Moon distance the distance series is centred on, km (Meeus 47). */
const MEAN_DISTANCE_KM = 385_000.56;

/** c₀ + c₁x + c₂x² + … */
function evaluatePolynomial(x: number, coefficients: readonly number[]): number {
  return coefficients.reduceRight((sum, coefficient) => sum * x + coefficient, 0);
}

/**
 * Meeus ch. 22, abridged: nutation in longitude Δψ and the true obliquity, from
 * the Moon's ascending node and the mean longitudes of the Sun and the Moon.
 * Sub-arcsecond, ample for a horizon position.
 */
const NODE_DEGREES = [125.04452, -1934.136261] as const;
const SUN_MEAN_LONGITUDE_DEGREES = [280.4665, 36000.7698] as const;
const MOON_MEAN_LONGITUDE_DEGREES = [218.3165, 481267.8813] as const;
/** Δψ amplitudes in arc seconds: sin Ω, sin 2L☉, sin 2L☾, sin 2Ω. */
const NUTATION_LONGITUDE_ARCSECONDS = [-17.2, -1.32, -0.23, 0.21] as const;
/** Δε amplitudes in arc seconds: cos Ω, cos 2L☉, cos 2L☾, cos 2Ω. */
const NUTATION_OBLIQUITY_ARCSECONDS = [9.2, 0.57, 0.1, -0.09] as const;
/** Meeus 22.2: the mean obliquity of the ecliptic, degrees. */
const MEAN_OBLIQUITY_DEGREES = [23.439291, -0.0130042, -0.00000016, 0.000000504] as const;

interface NutationObliquity {
  readonly nutationLongitudeDegrees: number;
  readonly trueObliquityRadians: number;
}

function nutationAndObliquity(t: number): NutationObliquity {
  const node = DEGREES_TO_RADIANS * evaluatePolynomial(t, NODE_DEGREES);
  const sunLongitude = DEGREES_TO_RADIANS * evaluatePolynomial(t, SUN_MEAN_LONGITUDE_DEGREES);
  const moonLongitude = DEGREES_TO_RADIANS * evaluatePolynomial(t, MOON_MEAN_LONGITUDE_DEGREES);
  const [psiNode, psiSun, psiMoon, psiDoubleNode] = NUTATION_LONGITUDE_ARCSECONDS;
  const [epsNode, epsSun, epsMoon, epsDoubleNode] = NUTATION_OBLIQUITY_ARCSECONDS;
  const nutationLongitudeDegrees =
    (psiNode * Math.sin(node) +
      psiSun * Math.sin(2 * sunLongitude) +
      psiMoon * Math.sin(2 * moonLongitude) +
      psiDoubleNode * Math.sin(2 * node)) /
    ARCSECONDS_PER_DEGREE;
  const nutationObliquityDegrees =
    (epsNode * Math.cos(node) +
      epsSun * Math.cos(2 * sunLongitude) +
      epsMoon * Math.cos(2 * moonLongitude) +
      epsDoubleNode * Math.cos(2 * node)) /
    ARCSECONDS_PER_DEGREE;

  return {
    nutationLongitudeDegrees,
    trueObliquityRadians:
      DEGREES_TO_RADIANS *
      (evaluatePolynomial(t, MEAN_OBLIQUITY_DEGREES) + nutationObliquityDegrees),
  };
}

/** Meeus 47.1–47.6: the fundamental arguments, degrees, in Julian centuries since J2000. */
const MOON_MEAN_LONGITUDE_SERIES = [
  218.3164477,
  481267.88123421,
  -0.0015786,
  1 / 538841,
  -1 / 65194000,
] as const;
const MEAN_ELONGATION_SERIES = [
  297.8501921,
  445267.1114034,
  -0.0018819,
  1 / 545868,
  -1 / 113065000,
] as const;
const SUN_MEAN_ANOMALY_SERIES = [357.5291092, 35999.0502909, -0.0001536, 1 / 24490000] as const;
const MOON_MEAN_ANOMALY_SERIES = [
  134.9633964,
  477198.8675055,
  0.0087414,
  1 / 69699,
  -1 / 14712000,
] as const;
const ARGUMENT_OF_LATITUDE_SERIES = [
  93.272095,
  483202.0175233,
  -0.0036539,
  -1 / 3526000,
  1 / 863310000,
] as const;
/** The three additive arguments of Meeus 47 (Venus, Jupiter, the flattening of the Earth), degrees. */
const VENUS_ARGUMENT_SERIES = [119.75, 131.849] as const;
const JUPITER_ARGUMENT_SERIES = [53.09, 479264.29] as const;
const FLATTENING_ARGUMENT_SERIES = [313.45, 481266.484] as const;
/** Meeus 47.6: the eccentricity factor that scales the terms in the Sun's anomaly. */
const ECCENTRICITY_SERIES = [1, -0.002516, -0.0000074] as const;

/** One row of Meeus table 47.A: multiples of D, M, M′, F and the Σl (µ°) and Σr (m) amplitudes. */
type LongitudeDistanceTerm = readonly [number, number, number, number, number, number];
/** One row of Meeus table 47.B: multiples of D, M, M′, F and the Σb (µ°) amplitude. */
type LatitudeTerm = readonly [number, number, number, number, number];

/** Meeus table 47.A — periodic terms for the Moon's longitude and distance. */
const LONGITUDE_DISTANCE_TERMS: readonly LongitudeDistanceTerm[] = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
  [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0],
  [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258],
  [2, 1, 1, 0, -810, 2616],
  [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117],
  [2, 2, -1, 0, -700, 2354],
  [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423],
  [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571],
  [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421],
  [1, 1, 1, 0, 351, 0],
  [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0],
  [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0],
  [2, 0, -1, -2, 0, 8752],
];

/** Meeus table 47.B — periodic terms for the Moon's latitude. */
const LATITUDE_TERMS: readonly LatitudeTerm[] = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491],
  [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344],
  [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021],
  [4, 0, -1, 1, 833],
  [0, 0, 1, -3, 777],
  [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607],
  [2, 0, 2, -1, 596],
  [2, -1, 1, -1, 491],
  [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439],
  [2, 0, 2, 1, 422],
  [2, 0, -3, -1, 421],
  [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351],
  [4, 0, 0, 1, 331],
  [2, -1, 1, 1, 315],
  [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283],
  [2, 1, 1, -1, -229],
  [1, 1, 0, -1, 223],
  [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220],
  [2, 1, -1, -1, -220],
  [1, 0, 1, 1, -185],
  [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177],
  [4, 0, -2, -1, 176],
  [4, -1, -1, -1, 166],
  [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132],
  [1, 0, -1, -1, -119],
  [4, -1, 0, -1, 115],
  [2, -2, 0, 1, 107],
];

/**
 * Meeus 47, p. 342 — the additive terms in longitude and latitude, µ°: the
 * action of Venus, of Jupiter and of the flattening of the Earth.
 */
const LONGITUDE_VENUS_MICRODEGREES = 3958;
const LONGITUDE_FLATTENING_MICRODEGREES = 1962;
const LONGITUDE_JUPITER_MICRODEGREES = 318;
const LATITUDE_MOON_LONGITUDE_MICRODEGREES = -2235;
const LATITUDE_FLATTENING_MICRODEGREES = 382;
const LATITUDE_VENUS_MICRODEGREES = 175;
const LATITUDE_ANOMALY_MICRODEGREES = 127;
const LATITUDE_ANOMALY_SUM_MICRODEGREES = -115;

export interface LunarCoordinates {
  readonly rightAscensionRadians: number;
  readonly declinationRadians: number;
  readonly distanceKm: number;
}

/** The eccentricity factor a term carries for its multiple of the Sun's anomaly (Meeus 47.6). */
function eccentricityFactor(sunAnomalyMultiple: number, eccentricity: number): number {
  switch (Math.abs(sunAnomalyMultiple)) {
    case 1:
      return eccentricity;
    case 2:
      return eccentricity * eccentricity;
    default:
      return 1;
  }
}

/** The Moon's geocentric apparent equatorial coordinates and distance, from days since J2000 in TT. */
export function moonEquatorialCoordinates(daysTt: number): LunarCoordinates {
  const t = daysTt / DAYS_PER_JULIAN_CENTURY;
  const meanLongitude = evaluatePolynomial(t, MOON_MEAN_LONGITUDE_SERIES);
  const elongation = DEGREES_TO_RADIANS * evaluatePolynomial(t, MEAN_ELONGATION_SERIES);
  const sunAnomaly = DEGREES_TO_RADIANS * evaluatePolynomial(t, SUN_MEAN_ANOMALY_SERIES);
  const moonAnomaly = DEGREES_TO_RADIANS * evaluatePolynomial(t, MOON_MEAN_ANOMALY_SERIES);
  const argumentOfLatitude =
    DEGREES_TO_RADIANS * evaluatePolynomial(t, ARGUMENT_OF_LATITUDE_SERIES);
  const venus = DEGREES_TO_RADIANS * evaluatePolynomial(t, VENUS_ARGUMENT_SERIES);
  const jupiter = DEGREES_TO_RADIANS * evaluatePolynomial(t, JUPITER_ARGUMENT_SERIES);
  const flattening = DEGREES_TO_RADIANS * evaluatePolynomial(t, FLATTENING_ARGUMENT_SERIES);
  const eccentricity = evaluatePolynomial(t, ECCENTRICITY_SERIES);
  const meanLongitudeRadians = DEGREES_TO_RADIANS * meanLongitude;

  let longitudeSum = 0;
  let distanceSum = 0;
  let latitudeSum = 0;

  for (const [d, m, mPrime, f, longitude, distance] of LONGITUDE_DISTANCE_TERMS) {
    const argument =
      d * elongation + m * sunAnomaly + mPrime * moonAnomaly + f * argumentOfLatitude;
    const factor = eccentricityFactor(m, eccentricity);

    longitudeSum += longitude * factor * Math.sin(argument);
    distanceSum += distance * factor * Math.cos(argument);
  }

  for (const [d, m, mPrime, f, latitude] of LATITUDE_TERMS) {
    const argument =
      d * elongation + m * sunAnomaly + mPrime * moonAnomaly + f * argumentOfLatitude;

    latitudeSum += latitude * eccentricityFactor(m, eccentricity) * Math.sin(argument);
  }

  longitudeSum +=
    LONGITUDE_VENUS_MICRODEGREES * Math.sin(venus) +
    LONGITUDE_FLATTENING_MICRODEGREES * Math.sin(meanLongitudeRadians - argumentOfLatitude) +
    LONGITUDE_JUPITER_MICRODEGREES * Math.sin(jupiter);
  latitudeSum +=
    LATITUDE_MOON_LONGITUDE_MICRODEGREES * Math.sin(meanLongitudeRadians) +
    LATITUDE_FLATTENING_MICRODEGREES * Math.sin(flattening) +
    LATITUDE_VENUS_MICRODEGREES * Math.sin(venus - argumentOfLatitude) +
    LATITUDE_VENUS_MICRODEGREES * Math.sin(venus + argumentOfLatitude) +
    LATITUDE_ANOMALY_MICRODEGREES * Math.sin(meanLongitudeRadians - moonAnomaly) +
    LATITUDE_ANOMALY_SUM_MICRODEGREES * Math.sin(meanLongitudeRadians + moonAnomaly);

  const { nutationLongitudeDegrees, trueObliquityRadians } = nutationAndObliquity(t);
  const apparentLongitude =
    DEGREES_TO_RADIANS *
    (meanLongitude + longitudeSum / MICRODEGREES_PER_DEGREE + nutationLongitudeDegrees);
  const latitude = DEGREES_TO_RADIANS * (latitudeSum / MICRODEGREES_PER_DEGREE);

  return {
    // Meeus 13.3 and 13.4
    rightAscensionRadians: Math.atan2(
      Math.sin(apparentLongitude) * Math.cos(trueObliquityRadians) -
        Math.tan(latitude) * Math.sin(trueObliquityRadians),
      Math.cos(apparentLongitude)
    ),
    declinationRadians: Math.asin(
      Math.sin(latitude) * Math.cos(trueObliquityRadians) +
        Math.cos(latitude) * Math.sin(trueObliquityRadians) * Math.sin(apparentLongitude)
    ),
    distanceKm: MEAN_DISTANCE_KM + distanceSum / METERS_PER_KILOMETER,
  };
}
