package io.github.frozik.callsfilter.screening.application

import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.GroupChoice
import io.github.frozik.callsfilter.screening.domain.GroupKind
import io.github.frozik.callsfilter.screening.domain.Ruleset

/** A stranger's call that rang through, waiting for the call to end so the shade can ask where it goes. */
data class PendingAsk(val epochMs: Long, val number: String?, val networkName: String?, val choices: List<GroupChoice>)

interface PendingAsks {
  fun remember(ask: PendingAsk)

  /** The ask of the call that just ended, at most once. */
  fun take(): PendingAsk?
}

/** Remembers the question; the end of the call, not the ring, is the moment to ask it. */
class WhereToAsk(private val pending: PendingAsks, private val next: AfterDecision) : AfterDecision {
  override fun handle(record: CallRecord, decision: Decision, ruleset: Ruleset) {
    val asks = decision.group.kind == GroupKind.STRANGERS && decision.letsThrough && ruleset.whereTo.isNotEmpty()
    if (asks && (record.number != null || record.networkName != null)) {
      pending.remember(PendingAsk(record.epochMs, record.number, record.networkName, ruleset.whereTo))
    }
    next.handle(record, decision, ruleset)
  }
}
