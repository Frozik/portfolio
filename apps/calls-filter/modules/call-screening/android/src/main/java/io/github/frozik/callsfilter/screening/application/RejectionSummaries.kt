package io.github.frozik.callsfilter.screening.application

import io.github.frozik.callsfilter.screening.domain.CalendarRule
import io.github.frozik.callsfilter.screening.domain.CalendarSource
import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.Moment
import io.github.frozik.callsfilter.screening.domain.Ruleset

private const val MILLISECONDS_PER_MINUTE = 60_000L
private const val DIGEST_DELAY_MS = 3_600_000L

/** A meeting under way: its title when the calendar tells it, and when it ends. */
data class Meeting(val title: String?, val endEpochMs: Long)

/** A device calendar's meeting at a moment, read live; `null` when there is none or it cannot be read. */
fun interface MeetingFinder {
  fun meetingAt(rule: CalendarRule, moment: Moment): Meeting?
}

/** Calls turned away and not told yet: after the meeting they fell in, or in the hourly digest. */
sealed interface PendingSummary {
  val dueEpochMs: Long
  val count: Int

  data class AfterMeeting(val meeting: Meeting, override val count: Int) : PendingSummary {
    override val dueEpochMs: Long get() = meeting.endEpochMs
  }

  data class Digest(override val dueEpochMs: Long, override val count: Int) : PendingSummary
}

interface SummaryStore {
  fun pending(): List<PendingSummary>

  fun save(pending: List<PendingSummary>)
}

fun interface SummaryShade {
  fun show(summary: PendingSummary)
}

/** Wakes the service when the next summary is due; `null` cancels the wake-up. */
fun interface SummaryAlarm {
  fun wakeAt(epochMs: Long?)
}

/**
 * No notification per turned-away call: a call during a meeting is told once the meeting is over
 * («During «Planning» 2 calls were turned away»), any other joins a digest at most once an hour.
 */
class RejectionSummaries(
  private val store: SummaryStore,
  private val shade: SummaryShade,
  private val alarm: SummaryAlarm,
  private val meetings: MeetingFinder,
  private val clock: Clock,
) {
  fun count(decision: Decision) {
    val moment = clock.now()
    val meeting = meetingOf(decision, moment)
    val pending = store.pending()
    val counted =
      if (meeting != null) {
        val same = pending.filterIsInstance<PendingSummary.AfterMeeting>().find { it.meeting == meeting }
        if (same == null) pending + PendingSummary.AfterMeeting(meeting, 1) else pending - same + same.copy(count = same.count + 1)
      } else {
        val digest = pending.filterIsInstance<PendingSummary.Digest>().firstOrNull()
        if (digest == null) pending + PendingSummary.Digest(moment.epochMs + DIGEST_DELAY_MS, 1) else pending - digest + digest.copy(count = digest.count + 1)
      }
    keep(counted)
  }

  /** What is due goes to the shade; the rest waits for the next wake-up. */
  fun deliver() {
    val now = clock.now().epochMs
    val (due, later) = store.pending().partition { it.dueEpochMs <= now }
    due.forEach(shade::show)
    keep(later)
  }

  private fun keep(pending: List<PendingSummary>) {
    store.save(pending)
    alarm.wakeAt(pending.minOfOrNull { it.dueEpochMs })
  }

  private fun meetingOf(decision: Decision, moment: Moment): Meeting? = decision.group.scheduled?.calendars.orEmpty().firstNotNullOfOrNull { rule ->
    when (rule.source) {
      is CalendarSource.Device -> meetings.meetingAt(rule, moment) ?: bakedMeeting(rule, moment)
      is CalendarSource.Ics -> bakedMeeting(rule, moment)
      CalendarSource.HolidaysHere -> null
    }
  }

  private fun bakedMeeting(rule: CalendarRule, moment: Moment): Meeting? = rule.bakedEvents.firstOrNull { it.contains(moment.localMinute) }?.let { window ->
    Meeting(null, moment.epochMs + (window.to - moment.localMinute) * MILLISECONDS_PER_MINUTE)
  }
}

/** Every call turned away is counted toward its summary. */
class RejectionSummariesAfter(private val summaries: RejectionSummaries, private val next: AfterDecision) : AfterDecision {
  override fun handle(record: CallRecord, decision: Decision, ruleset: Ruleset) {
    if (!decision.letsThrough) {
      summaries.count(decision)
    }
    next.handle(record, decision, ruleset)
  }
}
