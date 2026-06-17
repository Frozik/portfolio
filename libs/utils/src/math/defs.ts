export const FLOAT_DECIMALS_SEPARATOR = '.';
export const FLOAT_EXPONENT_MARKER = 'e';

/**
 * Matches a finite decimal number, optionally signed and in scientific
 * notation (e.g. `-12.5`, `+3`, `1e10`, `2.5E-3`). Shared by `trim` and
 * `getFractionLength` to keep their numeric validation in lockstep.
 */
export const FINITE_NUMBER_PATTERN = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/;
