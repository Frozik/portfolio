import { beforeEach, describe, expect, it } from 'vitest';

import { FIRE_REPEAT_TICKS } from './fire-repeat';
import { mergePlayerInputs } from './merge-player-inputs';
import { TouchControlSource } from './touch-control-source';

describe('TouchControlSource', () => {
  let source: TouchControlSource;

  beforeEach(() => {
    source = new TouchControlSource();

    return () => source.dispose();
  });

  it('reports no input while no zone is held', () => {
    expect(source.read()).toEqual({ direction: undefined, fire: false });
  });

  it('holds the last zone the thumb slid into', () => {
    source.setDirection('up');
    expect(source.read().direction).toBe('up');

    source.setDirection('right');
    expect(source.read().direction).toBe('right');

    source.setDirection(undefined);
    expect(source.read().direction).toBeUndefined();
  });

  it('raises the fire edge on press and repeats it on the keyboard cadence', () => {
    source.setFire(true);

    const fireTicks = Array.from({ length: FIRE_REPEAT_TICKS * 2 + 1 }, () => source.read().fire);

    expect(fireTicks[0]).toBe(true);
    expect(fireTicks.slice(1, FIRE_REPEAT_TICKS).some(Boolean)).toBe(false);
    expect(fireTicks[FIRE_REPEAT_TICKS]).toBe(true);
    expect(fireTicks[FIRE_REPEAT_TICKS * 2]).toBe(true);
  });

  it('re-arms the fire edge after the button is let go', () => {
    source.setFire(true);
    source.read();
    source.read();
    source.setFire(false);
    expect(source.read().fire).toBe(false);

    source.setFire(true);
    expect(source.read().fire).toBe(true);
  });

  it('steers and fires at the same time', () => {
    source.setDirection('left');
    source.setFire(true);

    expect(source.read()).toEqual({ direction: 'left', fire: true });
  });

  it('drops every held zone on release', () => {
    source.setDirection('down');
    source.setFire(true);
    source.release();

    expect(source.read()).toEqual({ direction: undefined, fire: false });
  });

  it('re-arms the fire edge after a release, so a stuck button cannot autofire', () => {
    source.setFire(true);
    source.read();
    source.release();
    source.setFire(true);

    expect(source.read().fire).toBe(true);
  });
});

describe('mergePlayerInputs', () => {
  const idle = { direction: undefined, fire: false } as const;

  it('falls back to the keyboard while no thumb is on the pad', () => {
    expect(mergePlayerInputs({ direction: 'up', fire: false }, idle).direction).toBe('up');
  });

  it('lets the touch pad win over a held key', () => {
    expect(
      mergePlayerInputs({ direction: 'up', fire: false }, { direction: 'down', fire: false })
        .direction
    ).toBe('down');
  });

  it('ors the fire edge so either device can shoot', () => {
    expect(mergePlayerInputs({ direction: undefined, fire: true }, idle).fire).toBe(true);
    expect(mergePlayerInputs(idle, { direction: undefined, fire: true }).fire).toBe(true);
    expect(mergePlayerInputs(idle, idle).fire).toBe(false);
  });
});
