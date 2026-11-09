package io.github.frozik.callsfilter.screening.adapters.android

import android.content.ContentResolver
import android.provider.CalendarContract
import io.github.frozik.callsfilter.screening.application.LiveCalendar
import io.github.frozik.callsfilter.screening.application.Meeting
import io.github.frozik.callsfilter.screening.application.MeetingFinder
import io.github.frozik.callsfilter.screening.domain.CalendarRule
import io.github.frozik.callsfilter.screening.domain.CalendarSource
import io.github.frozik.callsfilter.screening.domain.Moment
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

private const val SECONDS_PER_MINUTE = 60L
private const val MILLISECONDS_PER_MINUTE = 60_000L

/**
 * A device calendar read at the moment of the call: the provider is the phone's own database,
 * so this works offline. `null` when it cannot be read (no permission, calendar gone), and
 * the events the app baked into the ruleset decide instead.
 */
class DeviceCalendarEvents(private val resolver: ContentResolver) :
  LiveCalendar,
  MeetingFinder {
  override fun inEvent(rule: CalendarRule, minute: Long): Boolean? {
    val instant = LocalDateTime.ofEpochSecond(minute * SECONDS_PER_MINUTE, 0, ZoneOffset.UTC).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
    return eventsAt(rule, instant)?.isNotEmpty()
  }

  override fun meetingAt(rule: CalendarRule, moment: Moment): Meeting? = eventsAt(rule, moment.epochMs)?.maxByOrNull { it.endEpochMs }?.let {
    it.copy(endEpochMs = it.endEpochMs + rule.filter.minutesAfter * MILLISECONDS_PER_MINUTE)
  }

  /** The rule's events around an instant, its filter applied; `null` when the calendar cannot be read. */
  private fun eventsAt(rule: CalendarRule, epochMs: Long): List<Meeting>? {
    val source = rule.source as? CalendarSource.Device ?: return null
    return try {
      val calendarId = calendarId(source) ?: return null
      val from = epochMs - rule.filter.minutesAfter * MILLISECONDS_PER_MINUTE
      val to = epochMs + rule.filter.minutesBefore * MILLISECONDS_PER_MINUTE + 1
      CalendarContract.Instances.query(
        resolver,
        arrayOf(
          CalendarContract.Instances.CALENDAR_ID,
          CalendarContract.Instances.AVAILABILITY,
          CalendarContract.Instances.SELF_ATTENDEE_STATUS,
          CalendarContract.Instances.ALL_DAY,
          CalendarContract.Instances.TITLE,
          CalendarContract.Instances.END,
        ),
        from,
        to,
      )?.use { cursor ->
        buildList {
          while (cursor.moveToNext()) {
            val counts =
              cursor.long(CalendarContract.Instances.CALENDAR_ID) == calendarId &&
                (!rule.filter.busyOnly || cursor.int(CalendarContract.Instances.AVAILABILITY) == CalendarContract.Events.AVAILABILITY_BUSY) &&
                (!rule.filter.skipDeclined || cursor.int(CalendarContract.Instances.SELF_ATTENDEE_STATUS) != CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED) &&
                (rule.filter.includeAllDay || cursor.int(CalendarContract.Instances.ALL_DAY) == 0)
            if (counts) {
              add(Meeting(cursor.string(CalendarContract.Instances.TITLE)?.takeIf(String::isNotBlank), cursor.long(CalendarContract.Instances.END)))
            }
          }
        }
      }
    } catch (denied: SecurityException) {
      null
    }
  }

  private fun calendarId(source: CalendarSource.Device): Long? = resolver.query(
    CalendarContract.Calendars.CONTENT_URI,
    arrayOf(CalendarContract.Calendars._ID),
    "${CalendarContract.Calendars.ACCOUNT_TYPE} = ? AND ${CalendarContract.Calendars.ACCOUNT_NAME} = ? AND ${CalendarContract.Calendars.CALENDAR_DISPLAY_NAME} = ?",
    arrayOf(source.accountType, source.accountName, source.calendarName),
    null,
  )?.use { cursor -> if (cursor.moveToFirst()) cursor.getLong(0) else null }
}
