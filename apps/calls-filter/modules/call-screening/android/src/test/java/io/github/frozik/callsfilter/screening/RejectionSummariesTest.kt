package io.github.frozik.callsfilter.screening

import io.github.frozik.callsfilter.screening.application.Meeting
import io.github.frozik.callsfilter.screening.application.PendingSummary
import io.github.frozik.callsfilter.screening.application.RejectionSummaries
import io.github.frozik.callsfilter.screening.application.SummaryStore
import io.github.frozik.callsfilter.screening.domain.Action
import io.github.frozik.callsfilter.screening.domain.ActionNow
import io.github.frozik.callsfilter.screening.domain.ActionSource
import io.github.frozik.callsfilter.screening.domain.CalendarMode
import io.github.frozik.callsfilter.screening.domain.CalendarRule
import io.github.frozik.callsfilter.screening.domain.CalendarSource
import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.EventFilter
import io.github.frozik.callsfilter.screening.domain.Group
import io.github.frozik.callsfilter.screening.domain.GroupKind
import io.github.frozik.callsfilter.screening.domain.HolidayMode
import io.github.frozik.callsfilter.screening.domain.Moment
import io.github.frozik.callsfilter.screening.domain.Scheduled
import io.github.frozik.callsfilter.screening.domain.Verdict
import io.github.frozik.callsfilter.screening.domain.Window
import org.junit.Assert.assertEquals
import org.junit.Test

private const val START = 1_800_000_000_000L
private const val START_MINUTE = 30_000_000L
private const val MINUTE_MS = 60_000L
private const val HOUR_MS = 3_600_000L

private val FILTER = EventFilter(busyOnly = true, skipDeclined = true, includeAllDay = false, minutesBefore = 0, minutesAfter = 0)
private val WORK_CALENDAR = CalendarRule(CalendarMode.EXCEPT_EVENTS, FILTER, CalendarSource.Device("com.google", "me@example.com", "Work"), emptyList())
private val ICS_MEETINGS = CalendarRule(CalendarMode.EXCEPT_EVENTS, FILTER, CalendarSource.Ics("feed"), listOf(Window(START_MINUTE + 30, START_MINUTE + 90)))

private fun group(vararg calendars: CalendarRule) = Group(
  "work",
  GroupKind.CUSTOM,
  emptyList(),
  emptyList(),
  true,
  Action.BLOCK,
  Scheduled(Action.PASS, false, emptyList(), emptyList(), HolidayMode.NONE, calendars.toList()),
  5,
  null,
  0L,
  "",
)

private fun rejected(group: Group) = Decision(group, emptyList(), ActionNow(Action.BLOCK, ActionSource.OTHERWISE), Verdict.REJECTED)

private class SummaryWorld(private val meeting: Meeting?) {
  var minutes = 0L
  var pending: List<PendingSummary> = emptyList()
  val shown = mutableListOf<PendingSummary>()
  var wakeAt: Long? = null
  val summaries =
    RejectionSummaries(
      object : SummaryStore {
        override fun pending() = pending

        override fun save(pending: List<PendingSummary>) {
          this@SummaryWorld.pending = pending
        }
      },
      { shown += it },
      { wakeAt = it },
      { _, _ -> meeting },
      { Moment(START + minutes * MINUTE_MS, START_MINUTE + minutes) },
    )

  fun at(minute: Long): SummaryWorld = apply { minutes = minute }
}

class RejectionSummariesTest {
  private val planning = Meeting("Planning", START + HOUR_MS)

  @Test
  fun callsTurnedAwayDuringAMeetingAreToldOnceItIsOver() {
    val world = SummaryWorld(planning)
    world.summaries.count(rejected(group(WORK_CALENDAR)))
    world.at(10).summaries.count(rejected(group(WORK_CALENDAR)))
    assertEquals(START + HOUR_MS, world.wakeAt)
    world.at(30).summaries.deliver()
    assertEquals(emptyList<PendingSummary>(), world.shown)
    world.at(60).summaries.deliver()
    assertEquals(listOf(PendingSummary.AfterMeeting(planning, 2)), world.shown)
    assertEquals(null, world.wakeAt)
  }

  @Test
  fun aBakedICalEventIsAMeetingWithoutATitle() {
    val world = SummaryWorld(null).at(45)
    world.summaries.count(rejected(group(ICS_MEETINGS)))
    assertEquals(listOf(PendingSummary.AfterMeeting(Meeting(null, START + 90 * MINUTE_MS), 1)), world.pending)
  }

  @Test
  fun otherCallsGatherInADigestAtMostOnceAnHour() {
    val world = SummaryWorld(null)
    world.summaries.count(rejected(group()))
    world.at(20).summaries.count(rejected(group()))
    world.at(59).summaries.deliver()
    assertEquals(emptyList<PendingSummary>(), world.shown)
    world.at(60).summaries.deliver()
    assertEquals(listOf(PendingSummary.Digest(START + HOUR_MS, 2)), world.shown)
  }
}
