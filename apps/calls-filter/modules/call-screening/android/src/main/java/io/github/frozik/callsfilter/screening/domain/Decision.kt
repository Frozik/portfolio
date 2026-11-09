package io.github.frozik.callsfilter.screening.domain

enum class Verdict { PASSED, REJECTED, AWAITING_REPEAT, PASSED_AS_REPEAT, PAUSED }

data class Decision(val group: Group, val alsoClaimedBy: List<Group>, val action: ActionNow, val verdict: Verdict) {
  val letsThrough: Boolean get() = verdict != Verdict.REJECTED && verdict != Verdict.AWAITING_REPEAT
}

data class DecisionContext(
  val paused: Boolean,
  /** When this number was last turned away, from the journal: the evidence of a repeat. */
  val lastRejectedAtEpochMs: Long?,
  val facts: MomentFacts,
)

/** Fail-open for an open conflict: a group that lets the call ring wins, the older one on a tie. */
private fun settle(groups: List<Group>, moment: Moment, ruleset: Ruleset, facts: MomentFacts): Group {
  val actions = groups.associateWith { actionNow(it, moment, ruleset, facts).action }
  val lenient = if (Action.PASS in actions.values) Action.PASS else Action.BLOCK
  return groups.filter { actions[it] == lenient }.minBy { it.createdAtEpochMs }
}

private fun blockedVerdict(group: Group, ruleset: Ruleset, moment: Moment, context: DecisionContext): Verdict {
  if (!group.repeatPass.isOn(moment.epochMs) && !ruleset.repeatPass.isOn(moment.epochMs)) {
    return Verdict.REJECTED
  }
  val last = context.lastRejectedAtEpochMs
  val isRepeat = last != null && minutesBetween(last, moment.epochMs) <= group.repeatWindowMinutes
  return if (isRepeat) Verdict.PASSED_AS_REPEAT else Verdict.AWAITING_REPEAT
}

private fun verdictOf(action: ActionNow, group: Group, ruleset: Ruleset, moment: Moment, context: DecisionContext): Verdict = when (action.action) {
  Action.PASS -> Verdict.PASSED
  Action.BLOCK -> blockedVerdict(group, ruleset, moment, context)
}

/** The answer to a call from the published ruleset: the same as the app's own `decide`. */
fun decide(ruleset: Ruleset, caller: Caller, moment: Moment, context: DecisionContext): Decision {
  val found = membership(ruleset, caller, context.facts.networkCountry)
  val group =
    when (found) {
      is Membership.One -> found.group
      is Membership.Conflict -> settle(found.groups, moment, ruleset, context.facts)
    }
  val also = if (found is Membership.Conflict) found.groups.filter { it.id != group.id } else emptyList()
  val action = actionNow(group, moment, ruleset, context.facts)
  val verdict = if (context.paused) Verdict.PAUSED else verdictOf(action, group, ruleset, moment, context)
  return Decision(group, also, action, verdict)
}
