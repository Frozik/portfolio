package io.github.frozik.callsfilter.screening.domain

import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

private const val SECONDS_PER_MINUTE = 60L
private const val MILLISECONDS_PER_MINUTE = 60_000.0

/** A moment of the call: the instant, and the local wall-clock minute where the phone is. */
data class Moment(val epochMs: Long, val localMinute: Long)

/** Why a group is in force or not, as the app's `TActivity` says it. */
enum class Activity {
  ALWAYS,
  CONDITIONS_HOLD,
  CONDITIONS_UNMET,
  OFF,
  ;

  /** A group in force takes part in finding a caller's group; one that is not is passed over. */
  val active: Boolean get() = this == ALWAYS || this == CONDITIONS_HOLD
}

/** What the calendars and the phone say at the moment, beyond the ruleset. */
interface MomentFacts {
  val networkCountry: String?

  /** Whether a calendar rule's source has an event at the minute; baked events are the fallback. */
  fun inEvent(rule: CalendarRule, minute: Long): Boolean

  /** Whether the phone is at a place, as its geofence last said; `null` when unknown. */
  fun atPlace(placeId: String): Boolean?
}

/** A place whose state is unknown does not count: the schedule and the calendars decide alone. */
private fun placesAllow(places: List<PlaceRule>, facts: MomentFacts): Boolean = places.all { place ->
  val here = facts.atPlace(place.id) ?: return@all true
  if (place.mode == PlaceMode.ONLY_AT) here else !here
}

/** The call's moment on the schedule's clock: its own zone's wall time, or the phone's. */
private fun scheduleMinute(conditions: Conditions, moment: Moment): Long {
  val zone = conditions.zone ?: return moment.localMinute
  val wallClock = LocalDateTime.ofInstant(Instant.ofEpochMilli(moment.epochMs), ZoneId.of(zone))
  return wallClock.toEpochSecond(ZoneOffset.UTC) / SECONDS_PER_MINUTE
}

private fun inSchedule(conditions: Conditions, minute: Long, ruleset: Ruleset): Boolean {
  if (!conditions.hasSchedule) {
    return true
  }
  return minute < ruleset.horizonEndMinute && conditions.windows.any { it.contains(minute) }
}

private fun conditionsHold(conditions: Conditions, moment: Moment, ruleset: Ruleset, facts: MomentFacts): Boolean {
  fun inEvent(rule: CalendarRule): Boolean = facts.inEvent(rule, moment.localMinute)
  val exceptRules = conditions.calendars.filter { it.mode == CalendarMode.EXCEPT_EVENTS }
  val onlyRules = conditions.calendars.filter { it.mode == CalendarMode.ONLY_DURING_EVENTS }
  return placesAllow(conditions.places, facts) &&
    inSchedule(conditions, scheduleMinute(conditions, moment), ruleset) &&
    exceptRules.none { inEvent(it) } &&
    (onlyRules.isEmpty() || onlyRules.any { inEvent(it) })
}

/** Whether a group is in force now: switched off it is not; then its conditions decide. */
fun activityNow(group: Group, moment: Moment, ruleset: Ruleset, facts: MomentFacts): Activity {
  if (group.off) {
    return Activity.OFF
  }
  val conditions = group.conditions ?: return Activity.ALWAYS
  return if (conditionsHold(conditions, moment, ruleset, facts)) Activity.CONDITIONS_HOLD else Activity.CONDITIONS_UNMET
}

internal fun minutesBetween(fromEpochMs: Long, toEpochMs: Long): Double = (toEpochMs - fromEpochMs) / MILLISECONDS_PER_MINUTE
