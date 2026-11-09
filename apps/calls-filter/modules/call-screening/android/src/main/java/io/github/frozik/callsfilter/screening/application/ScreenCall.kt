package io.github.frozik.callsfilter.screening.application

import io.github.frozik.callsfilter.screening.domain.ActionSource
import io.github.frozik.callsfilter.screening.domain.CalendarRule
import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.DecisionContext
import io.github.frozik.callsfilter.screening.domain.Group
import io.github.frozik.callsfilter.screening.domain.MomentFacts
import io.github.frozik.callsfilter.screening.domain.UntilKind
import io.github.frozik.callsfilter.screening.domain.Verdict
import io.github.frozik.callsfilter.screening.domain.decide

/** The one answer the system gets for a call. */
sealed interface ScreeningReply {
  data object Allow : ScreeningReply

  data object Reject : ScreeningReply
}

private const val MILLISECONDS_PER_MINUTE = 60_000L

class ScreenCall(
  private val rulesets: RulesetSource,
  private val callers: CallerResolver,
  private val journal: CallJournal,
  private val runtime: RuntimeState,
  private val calendar: LiveCalendar,
  private val country: NetworkCountry,
  private val clock: Clock,
  private val diagnostics: Diagnostics,
  private val after: AfterDecision,
) {
  fun execute(call: IncomingCall): ScreeningReply {
    val ruleset =
      when (val load = rulesets.current()) {
        is RulesetLoad.Loaded -> load.ruleset

        RulesetLoad.Missing -> {
          diagnostics.log(Level.WARN, "screening", "no-ruleset", emptyMap())
          return ScreeningReply.Allow
        }

        is RulesetLoad.Failed -> {
          diagnostics.log(Level.ERROR, "screening", "ruleset-unreadable", mapOf("reason" to load.reason))
          return ScreeningReply.Allow
        }
      }
    val moment = clock.now()
    val caller = callers.resolve(call, ruleset.homeCountry)
    val networkCountry = country.current()
    val facts =
      object : MomentFacts {
        override val networkCountry: String? = networkCountry

        override fun inEvent(rule: CalendarRule, minute: Long): Boolean = calendar.inEvent(rule, minute) ?: rule.bakedEvents.any { it.contains(minute) }

        override fun temporaryReleased(group: Group): Boolean {
          val temporary = group.temporary ?: return false
          return runtime.temporaryReleased(group.id, temporary.setAtEpochMs)
        }

        override fun atPlace(placeId: String): Boolean? = runtime.atPlace(placeId)
      }
    val paused = (runtime.pausedUntilEpochMs() ?: 0L) > moment.epochMs
    val lastRejected =
      caller.number?.let { number ->
        val longestWindow = ruleset.groups.maxOfOrNull { it.repeatWindowMinutes } ?: 0
        journal.lastRejectedAt(number, moment.epochMs - longestWindow * MILLISECONDS_PER_MINUTE)
      }
    val decision = decide(ruleset, caller, moment, DecisionContext(paused, lastRejected, facts))
    consumeFirstPass(decision)
    val record =
      CallRecord(
        epochMs = moment.epochMs,
        rawNumber = call.rawNumber,
        number = caller.number,
        networkName = call.networkName,
        contactName = caller.contact?.displayName,
        contactLookupKey = caller.contact?.lookupKey,
        groupId = decision.group.id,
        verdict = decision.verdict.name,
        actionSource = decision.action.source.name,
        alsoClaimedBy = decision.alsoClaimedBy.map { it.id },
      )
    journal.record(record)
    if (decision.alsoClaimedBy.isNotEmpty()) {
      diagnostics.log(Level.WARN, "conflict", "call-in-several-groups", mapOf("groups" to (listOf(decision.group.id) + record.alsoClaimedBy).joinToString(",")))
    }
    after.handle(record, decision, ruleset)
    return if (decision.letsThrough) ScreeningReply.Allow else ScreeningReply.Reject
  }

  private fun consumeFirstPass(decision: Decision) {
    val temporary = decision.group.temporary ?: return
    val passed = decision.verdict == Verdict.PASSED || decision.verdict == Verdict.PASSED_AS_REPEAT
    if (temporary.until == UntilKind.FIRST_PASS && passed && decision.action.source == ActionSource.TEMPORARY) {
      runtime.releaseTemporary(decision.group.id, temporary.setAtEpochMs)
    }
  }
}
