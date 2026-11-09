package io.github.frozik.callsfilter.screening.application

import io.github.frozik.callsfilter.screening.domain.Action
import io.github.frozik.callsfilter.screening.domain.ActionSource
import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.GroupKind
import io.github.frozik.callsfilter.screening.domain.Ruleset
import io.github.frozik.callsfilter.screening.domain.UntilKind

/** A temporary policy in force, as the shade shows it while it lasts. */
data class TemporaryNotice(
  val groupId: String,
  val groupKind: GroupKind,
  val groupName: String,
  val action: Action,
  val until: UntilKind,
  val untilEpochMs: Long,
  val setAtEpochMs: Long,
)

/** The shade's notices of temporary policies: a notice not listed leaves it. */
fun interface TemporaryShade {
  fun show(notices: List<TemporaryNotice>)
}

/** Keeps the shade in step with the temporary policies in force, and takes one back on request. */
class TemporaryNotices(private val rulesets: RulesetSource, private val runtime: RuntimeState, private val shade: TemporaryShade, private val clock: Clock) {
  fun refresh() {
    refresh((rulesets.current() as? RulesetLoad.Loaded)?.ruleset)
  }

  fun refresh(ruleset: Ruleset?) {
    val now = clock.now().epochMs
    val notices =
      ruleset?.groups.orEmpty().mapNotNull { group ->
        group.temporary
          ?.takeIf { it.untilEpochMs > now && !runtime.temporaryReleased(group.id, it.setAtEpochMs) }
          ?.let { TemporaryNotice(group.id, group.kind, group.name, it.action, it.until, it.untilEpochMs, it.setAtEpochMs) }
      }
    shade.show(notices)
  }

  /** «Back to usual» from the shade: the service stops applying it now, the app drops it from the group. */
  fun takeBack(groupId: String, setAtEpochMs: Long) {
    runtime.releaseTemporary(groupId, setAtEpochMs)
    refresh()
  }
}

/** A call a temporary policy answered may have used it up, so the shade follows right away. */
class TemporaryNoticesAfter(private val notices: TemporaryNotices, private val next: AfterDecision) : AfterDecision {
  override fun handle(record: CallRecord, decision: Decision, ruleset: Ruleset) {
    if (decision.action.source == ActionSource.TEMPORARY) {
      notices.refresh(ruleset)
    }
    next.handle(record, decision, ruleset)
  }
}
