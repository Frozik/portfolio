package io.github.frozik.callsfilter.screening.domain

enum class Verdict { PASSED, REJECTED, AWAITING_REPEAT, PASSED_AS_REPEAT, PAUSED }

/** `activity` says why the group decided; a group not in force — «Strangers» off — lets the call ring. */
data class Decision(val group: Group, val alsoClaimedBy: List<Group>, val activity: Activity, val action: Action, val verdict: Verdict) {
  val letsThrough: Boolean get() = verdict != Verdict.REJECTED && verdict != Verdict.AWAITING_REPEAT
}

data class DecisionContext(
  val paused: Boolean,
  /** When this number was last turned away, from the journal: the evidence of a repeat. */
  val lastRejectedAtEpochMs: Long?,
  val facts: MomentFacts,
)

/** Fail-open for an open conflict: a group that lets the call ring wins, the older one on a tie. */
private fun settle(groups: List<Group>): Group {
  val lenient = if (groups.any { it.action == Action.PASS }) Action.PASS else Action.BLOCK
  return groups.filter { it.action == lenient }.minBy { it.createdAtEpochMs }
}

private fun blockedVerdict(group: Group, ruleset: Ruleset, moment: Moment, context: DecisionContext): Verdict {
  if (!group.repeatPass.isOn(moment.epochMs) && !ruleset.repeatPass.isOn(moment.epochMs)) {
    return Verdict.REJECTED
  }
  val last = context.lastRejectedAtEpochMs
  val isRepeat = last != null && minutesBetween(last, moment.epochMs) <= group.repeatWindowMinutes
  return if (isRepeat) Verdict.PASSED_AS_REPEAT else Verdict.AWAITING_REPEAT
}

private fun verdictOf(action: Action, group: Group, ruleset: Ruleset, moment: Moment, context: DecisionContext): Verdict = when (action) {
  Action.PASS -> Verdict.PASSED
  Action.BLOCK -> blockedVerdict(group, ruleset, moment, context)
}

/** The answer to a call from the published ruleset, groups not in force passed over: the same as the app's own `decide`. */
fun decide(ruleset: Ruleset, caller: Caller, moment: Moment, context: DecisionContext): Decision {
  fun activityOf(group: Group) = activityNow(group, moment, ruleset, context.facts)
  val found = membership(ruleset, caller, context.facts.networkCountry) { activityOf(it).active }
  val group =
    when (found) {
      is Membership.One -> found.group
      is Membership.Conflict -> settle(found.groups)
    }
  val also = if (found is Membership.Conflict) found.groups.filter { it.id != group.id } else emptyList()
  val activity = activityOf(group)
  val action = if (activity.active) group.action else Action.PASS
  val verdict = if (context.paused) Verdict.PAUSED else verdictOf(action, group, ruleset, moment, context)
  return Decision(group, also, activity, action, verdict)
}
