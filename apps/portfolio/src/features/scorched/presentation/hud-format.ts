import { clamp } from 'lodash-es';

import { PERCENT_SCALE } from '../domain/constants';

/** Aim readouts carry a decimal only while a fine step has actually put one there. */
const FINE_STEP_DECIMALS = 1;

export function formatAimValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(FINE_STEP_DECIMALS);
}

export function toHealthPercent(health: number, maxHealth: number): number {
  return clamp((health / maxHealth) * PERCENT_SCALE, 0, PERCENT_SCALE);
}

/** The shop's prices are whole dollars; the grouping follows the visitor's own locale. */
export function formatCash(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}
