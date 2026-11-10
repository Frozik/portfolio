package io.github.frozik.callsfilter.screening.application

import io.github.frozik.callsfilter.screening.domain.CalendarRule
import io.github.frozik.callsfilter.screening.domain.Caller
import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.Moment
import io.github.frozik.callsfilter.screening.domain.Ruleset

/** The ruleset the app last published, or why there is none (then every call passes). */
sealed interface RulesetLoad {
  data class Loaded(val ruleset: Ruleset) : RulesetLoad

  data object Missing : RulesetLoad

  data class Failed(val reason: String) : RulesetLoad
}

fun interface RulesetSource {
  fun current(): RulesetLoad
}

/** What the call itself says, before the address book and the numbering plan are asked. */
data class IncomingCall(val rawNumber: String?, val networkName: String?)

fun interface CallerResolver {
  fun resolve(call: IncomingCall, homeCountry: String): Caller
}

data class CallRecord(
  val epochMs: Long,
  val rawNumber: String?,
  val number: String?,
  val networkName: String?,
  val contactName: String?,
  val contactLookupKey: String?,
  val groupId: String,
  val verdict: String,
  val actionSource: String,
  val alsoClaimedBy: List<String>,
)

interface CallJournal {
  /** When this number was last turned away, if within the window. */
  fun lastRejectedAt(number: String, sinceEpochMs: Long): Long?

  fun record(record: CallRecord)
}

interface RuntimeState {
  fun pausedUntilEpochMs(): Long?

  /** Whether the phone is at a place, as the app last heard from its geofence; `null` when unknown. */
  fun atPlace(placeId: String): Boolean?
}

/** A live look at a device calendar; `null` when it cannot be read now, and the baked events decide. */
fun interface LiveCalendar {
  fun inEvent(rule: CalendarRule, minute: Long): Boolean?
}

fun interface NetworkCountry {
  fun current(): String?
}

fun interface Clock {
  fun now(): Moment
}

enum class Level { DEBUG, INFO, WARN, ERROR }

fun interface Diagnostics {
  fun log(level: Level, category: String, event: String, fields: Map<String, String>)
}

/** What follows a decision once the system has its answer: an SMS, a notification. */
fun interface AfterDecision {
  fun handle(record: CallRecord, decision: Decision, ruleset: Ruleset)
}
