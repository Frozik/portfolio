import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';
import type { Temporal } from 'temporal-polyfill';

import type { SiteLocation } from '../domain/model/site-plan';
import type { DayWindow } from '../domain/sun/day-window';
import { clampTimeToWindow, computeDayWindow } from '../domain/sun/day-window';
import type { Sunlight } from '../domain/sun/sun-direction';
import { computeSunlight } from '../domain/sun/sun-direction';
import type { SunPosition } from '../domain/sun/sun-position';
import { computeSunPosition } from '../domain/sun/sun-position';
import { resolveMoment, today } from '../domain/sun/sun-study';

/**
 * How often the played day advances, and by how much. A shorter tick is below
 * what reads as a step, and three minutes of sun per tick sweeps a summer day
 * in about half a minute.
 */
const SUN_ANIMATION_INTERVAL_MS = 50;
const SUN_ANIMATION_STEP_MINUTES = 3;

/**
 * The sun study: the date and time of day the 3D view is lit at, and whether
 * the day is playing .
 *
 * Its own object rather than eight more members of the plan store, because it
 * is a self-contained concern with STATE OF ITS OWN and a lifetime to manage —
 * a running timer that must be stopped when the study closes, when the view
 * changes and when the feature is disposed. It is also ephemeral by design: a
 * way of looking at the plan rather than part of it, so it stays out of the
 * snapshot, out of storage and out of the undo stack.
 */
export class SunStudy {
  isOpen = false;
  date: Temporal.PlainDate;
  isAnimating = false;
  /**
   * The time the user has chosen, before it is fitted to the daylight of the
   * day being studied. Nothing until they choose one: a study opened on a fresh
   * date starts at midday of that date's own daylight rather than at a time
   * carried over from another season.
   */
  timeOverrideMinutes: number | undefined = undefined;

  /** Where the plot is — the sun is computed against the site's own location. */
  private readonly readLocation: () => SiteLocation;
  private animationTimer: ReturnType<typeof setInterval> | undefined = undefined;

  constructor(readLocation: () => SiteLocation) {
    this.readLocation = readLocation;
    this.date = today(readLocation());
    makeAutoObservable<SunStudy, 'animationTimer' | 'readLocation'>(
      this,
      { animationTimer: false, readLocation: false, date: observableRef },
      { autoBind: true }
    );
  }

  /** Sunrise and sunset of the studied date — the span the time slider covers. */
  get dayWindow(): DayWindow {
    return computeDayWindow({ date: this.date, location: this.readLocation() });
  }

  /** The time being studied, always inside the daylight of the studied date. */
  get timeMinutes(): number {
    const { dayWindow, timeOverrideMinutes } = this;

    return clampTimeToWindow(timeOverrideMinutes ?? middleOf(dayWindow), dayWindow);
  }

  get moment(): Temporal.ZonedDateTime {
    return resolveMoment({
      date: this.date,
      timeMinutes: this.timeMinutes,
      timeZoneId: this.readLocation().timeZoneId,
    });
  }

  get position(): SunPosition {
    const { latitudeDegrees, longitudeDegrees } = this.readLocation();

    return computeSunPosition({ moment: this.moment, latitudeDegrees, longitudeDegrees });
  }

  /** Where the light comes from, turned by the plan's own north (R14). */
  get light(): Sunlight {
    return computeSunlight(this.position, this.readLocation().northOffsetDegrees);
  }

  /** The ☀ toolbar button: shows or hides the study bar over the 3D view. */
  toggleOpen(): void {
    this.isOpen = !this.isOpen;

    if (!this.isOpen) {
      this.stopAnimation();
    }
  }

  setDate(date: Temporal.PlainDate): void {
    this.date = date;
  }

  setTimeMinutes(timeMinutes: number): void {
    this.timeOverrideMinutes = timeMinutes;
  }

  toggleAnimation(): void {
    if (this.isAnimating) {
      this.stopAnimation();

      return;
    }

    this.isAnimating = true;
    this.animationTimer = setInterval(this.advance, SUN_ANIMATION_INTERVAL_MS);
  }

  stopAnimation(): void {
    if (!isNil(this.animationTimer)) {
      clearInterval(this.animationTimer);
      this.animationTimer = undefined;
    }

    this.isAnimating = false;
  }

  /** The played day: a step of sun, wrapping back to sunrise at dusk. */
  private advance(): void {
    const { dayWindow } = this;
    const next = this.timeMinutes + SUN_ANIMATION_STEP_MINUTES;

    this.timeOverrideMinutes = next > dayWindow.sunsetMinutes ? dayWindow.sunriseMinutes : next;
  }
}

/** Midday of the daylight — where a study opens before anything is dragged. */
function middleOf(window: DayWindow): number {
  return (window.sunriseMinutes + window.sunsetMinutes) / 2;
}
