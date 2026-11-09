package io.github.frozik.callsfilter.screening.domain

import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

private const val MINUTES_PER_DAY = 1440L
private const val SECONDS_PER_MINUTE = 60L
private const val MILLISECONDS_PER_MINUTE = 60_000.0

/** A moment of the call: the instant, and the local wall-clock minute where the phone is. */
data class Moment(val epochMs: Long, val localMinute: Long)

enum class ActionSource { TEMPORARY, SCHEDULED, OTHERWISE }

data class ActionNow(val action: Action, val source: ActionSource)

/** What the calendars and the phone say at the moment, beyond the ruleset. */
interface MomentFacts {
  val networkCountry: String?

  /** Whether a calendar rule's source has an event at the minute; baked events are the fallback. */
  fun inEvent(rule: CalendarRule, minute: Long): Boolean

  /** Whether a temporary policy was released since it was set: used up by its first pass, or taken back from the shade. */
  fun temporaryReleased(group: Group): Boolean

  /** Whether the phone is at a place, as its geofence last said; `null` when unknown. */
  fun atPlace(placeId: String): Boolean?
}

/** A place whose state is unknown does not count: the schedule and the calendars decide alone. */
private fun placesAllow(places: List<PlaceRule>, facts: MomentFacts): Boolean = places.all { place ->
  val here = facts.atPlace(place.id) ?: return@all true
  if (place.mode == PlaceMode.ONLY_AT) here else !here
}

/** The call's moment on the schedule's clock: its own zone's wall time, or the phone's. */
private fun scheduleMinute(scheduled: Scheduled, moment: Moment): Long {
  val zone = scheduled.zone ?: return moment.localMinute
  val wallClock = LocalDateTime.ofInstant(Instant.ofEpochMilli(moment.epochMs), ZoneId.of(zone))
  return wallClock.toEpochSecond(ZoneOffset.UTC) / SECONDS_PER_MINUTE
}

private fun holidayStarts(ruleset: Ruleset, country: String?): List<Long> = if (country == null) emptyList() else ruleset.holidayDayStarts[country].orEmpty()

private fun timeWindow(dayStart: Long, time: TimeOfDay): Window {
  if (time.allDay) {
    return Window(dayStart, dayStart + MINUTES_PER_DAY)
  }
  val from = dayStart + time.fromMinuteOfDay
  val endsNextDay = time.toMinuteOfDay <= time.fromMinuteOfDay
  val to = dayStart + (if (endsNextDay) MINUTES_PER_DAY else 0L) + time.toMinuteOfDay
  return Window(from, to)
}

private fun inSchedule(scheduled: Scheduled, minute: Long, holidays: List<Long>, ruleset: Ruleset): Boolean {
  if (!scheduled.hasSchedule) {
    return true
  }
  val inBase = minute < ruleset.horizonEndMinute && scheduled.windows.any { it.contains(minute) }
  return when (scheduled.holidays) {
    HolidayMode.NONE -> inBase

    HolidayMode.NOT_ON_HOLIDAYS -> inBase && holidays.none { Window(it, it + MINUTES_PER_DAY).contains(minute) }

    HolidayMode.ALSO_ON_HOLIDAYS ->
      inBase || holidays.any { start -> scheduled.times.any { timeWindow(start, it).contains(minute) } }
  }
}

private fun inScheduledWindows(scheduled: Scheduled, moment: Moment, ruleset: Ruleset, facts: MomentFacts): Boolean {
  val holidays = holidayStarts(ruleset, facts.networkCountry)
  fun inEvent(rule: CalendarRule): Boolean = when (rule.source) {
    CalendarSource.HolidaysHere -> holidays.any { Window(it, it + MINUTES_PER_DAY).contains(moment.localMinute) }
    else -> facts.inEvent(rule, moment.localMinute)
  }
  val exceptRules = scheduled.calendars.filter { it.mode == CalendarMode.EXCEPT_EVENTS }
  val onlyRules = scheduled.calendars.filter { it.mode == CalendarMode.ONLY_DURING_EVENTS }
  return placesAllow(scheduled.places, facts) &&
    inSchedule(scheduled, scheduleMinute(scheduled, moment), holidays, ruleset) &&
    exceptRules.none { inEvent(it) } &&
    (onlyRules.isEmpty() || onlyRules.any { inEvent(it) })
}

private fun temporaryActive(group: Group, moment: Moment, facts: MomentFacts): TemporaryPolicy? {
  val temporary = group.temporary ?: return null
  val ended = temporary.untilEpochMs <= moment.epochMs
  return if (ended || facts.temporaryReleased(group)) null else temporary
}

/** What a group does with a call now: the temporary policy, else the scheduled action in its windows, else the default. */
fun actionNow(group: Group, moment: Moment, ruleset: Ruleset, facts: MomentFacts): ActionNow {
  temporaryActive(group, moment, facts)?.let { return ActionNow(it.action, ActionSource.TEMPORARY) }
  val scheduled = group.scheduled ?: return ActionNow(group.otherwise, ActionSource.OTHERWISE)
  return if (inScheduledWindows(scheduled, moment, ruleset, facts)) {
    ActionNow(scheduled.action, ActionSource.SCHEDULED)
  } else {
    ActionNow(group.otherwise, ActionSource.OTHERWISE)
  }
}

internal fun minutesBetween(fromEpochMs: Long, toEpochMs: Long): Double = (toEpochMs - fromEpochMs) / MILLISECONDS_PER_MINUTE
