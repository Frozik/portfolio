import { describe, expect, it, vi } from 'vitest';

import { TICKS_PER_SECOND } from '../domain/constants';
import { createFixedStepSimulation } from './fixed-step-simulation';

const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;
const TAB_SWITCH_STALL_SECONDS = 2;
const STALL_TICK_CAP = 4;

function ticks(count: number): number {
  return count * SECONDS_PER_TICK;
}

describe('fixed-step simulation', () => {
  it('steps nothing on the first frame — no time has elapsed yet', () => {
    const step = vi.fn();
    const simulation = createFixedStepSimulation({ isRunning: () => true, step });

    simulation.advance(ticks(10));

    expect(step).not.toHaveBeenCalled();
  });

  it('steps once per tick of elapsed time and carries the remainder into the next frame', () => {
    const step = vi.fn();
    const simulation = createFixedStepSimulation({ isRunning: () => true, step });

    simulation.advance(0);
    simulation.advance(ticks(1.5));
    expect(step).toHaveBeenCalledTimes(1);

    simulation.advance(ticks(3));
    expect(step).toHaveBeenCalledTimes(3);
  });

  it('caps a stall at four ticks instead of replaying it', () => {
    const step = vi.fn();
    const simulation = createFixedStepSimulation({ isRunning: () => true, step });

    simulation.advance(0);
    simulation.advance(TAB_SWITCH_STALL_SECONDS);

    expect(step).toHaveBeenCalledTimes(STALL_TICK_CAP);
  });

  it('drops the time that passed while stopped instead of replaying it', () => {
    const step = vi.fn();
    let isRunning = true;
    const simulation = createFixedStepSimulation({ isRunning: () => isRunning, step });

    simulation.advance(0);
    isRunning = false;
    simulation.advance(TAB_SWITCH_STALL_SECONDS);
    isRunning = true;
    simulation.advance(TAB_SWITCH_STALL_SECONDS + ticks(1.5));

    expect(step).toHaveBeenCalledTimes(1);
  });
});
