package io.github.frozik.callsfilter.screening

import io.github.frozik.callsfilter.screening.application.AfterDecision
import io.github.frozik.callsfilter.screening.application.CallJournal
import io.github.frozik.callsfilter.screening.application.CallRecord
import io.github.frozik.callsfilter.screening.application.CallerResolver
import io.github.frozik.callsfilter.screening.application.IncomingCall
import io.github.frozik.callsfilter.screening.application.RulesetLoad
import io.github.frozik.callsfilter.screening.application.RuntimeState
import io.github.frozik.callsfilter.screening.application.ScreenCall
import io.github.frozik.callsfilter.screening.application.ScreeningReply
import io.github.frozik.callsfilter.screening.application.TemporaryNotice
import io.github.frozik.callsfilter.screening.application.TemporaryNotices
import io.github.frozik.callsfilter.screening.application.TemporaryNoticesAfter
import io.github.frozik.callsfilter.screening.domain.Action
import io.github.frozik.callsfilter.screening.domain.Caller
import io.github.frozik.callsfilter.screening.domain.Group
import io.github.frozik.callsfilter.screening.domain.GroupKind
import io.github.frozik.callsfilter.screening.domain.Member
import io.github.frozik.callsfilter.screening.domain.Moment
import io.github.frozik.callsfilter.screening.domain.Ruleset
import io.github.frozik.callsfilter.screening.domain.TemporaryPolicy
import io.github.frozik.callsfilter.screening.domain.UntilKind
import org.junit.Assert.assertEquals
import org.junit.Test

private const val NOW = 1_800_000_000_000L
private const val HOUR_MS = 3_600_000L

private fun group(id: String, temporary: TemporaryPolicy?, otherwise: Action = Action.BLOCK) =
  Group(id, GroupKind.CUSTOM, listOf(Member.Number(Regex("^7495\\d*$"))), emptyList(), true, otherwise, null, 5, temporary, 0L, "", name = id)

private fun ruleset(vararg groups: Group) = Ruleset(1, 0L, Long.MAX_VALUE, "NL", groups.toList())

private class TemporaryWorld(var ruleset: Ruleset) {
  val released = mutableSetOf<String>()
  var shown: List<TemporaryNotice> = emptyList()
  val runtime =
    object : RuntimeState {
      override fun pausedUntilEpochMs(): Long? = null

      override fun temporaryReleased(groupId: String, setAtEpochMs: Long): Boolean = "$groupId@$setAtEpochMs" in released

      override fun releaseTemporary(groupId: String, setAtEpochMs: Long) {
        released += "$groupId@$setAtEpochMs"
      }

      override fun atPlace(placeId: String): Boolean? = null
    }
  val notices = TemporaryNotices({ RulesetLoad.Loaded(ruleset) }, runtime, { shown = it }, { Moment(NOW, 0L) })
  val screenCall =
    ScreenCall(
      rulesets = { RulesetLoad.Loaded(ruleset) },
      callers = CallerResolver { call, _ -> Caller(call.rawNumber?.removePrefix("+"), "NL", null, null, null) },
      journal =
      object : CallJournal {
        override fun lastRejectedAt(number: String, sinceEpochMs: Long): Long? = null

        override fun record(record: CallRecord) = Unit
      },
      runtime = runtime,
      calendar = { _, _ -> null },
      country = { "NL" },
      clock = { Moment(NOW, 0L) },
      diagnostics = { _, _, _, _ -> },
      after = TemporaryNoticesAfter(notices, AfterDecision { _, _, _ -> }),
    )
}

class TemporaryNoticesTest {
  private val passForAnHour = TemporaryPolicy(Action.PASS, UntilKind.INSTANT, NOW + HOUR_MS, NOW - HOUR_MS)
  private val passUntilFirstCall = TemporaryPolicy(Action.PASS, UntilKind.FIRST_PASS, NOW + 24 * HOUR_MS, NOW - HOUR_MS)

  @Test
  fun theShadeShowsEveryTemporaryPolicyInForceAndNothingElse() {
    val ended = TemporaryPolicy(Action.PASS, UntilKind.INSTANT, NOW - 1, NOW - HOUR_MS)
    val world = TemporaryWorld(ruleset(group("delivery", passForAnHour), group("old", ended), group("spam", null)))
    world.notices.refresh()
    assertEquals(listOf("delivery"), world.shown.map { it.groupName })
  }

  @Test
  fun takingAPolicyBackFromTheShadeStopsItAtOnce() {
    val world = TemporaryWorld(ruleset(group("delivery", passForAnHour)))
    world.notices.refresh()
    world.notices.takeBack("delivery", passForAnHour.setAtEpochMs)
    assertEquals(emptyList<TemporaryNotice>(), world.shown)
    assertEquals(ScreeningReply.Reject, world.screenCall.execute(IncomingCall("+74951234567", null)))
  }

  @Test
  fun theFirstCallThatRingsUsesUpItsPolicyAndTheNoticeLeaves() {
    val world = TemporaryWorld(ruleset(group("delivery", passUntilFirstCall)))
    world.notices.refresh()
    assertEquals(1, world.shown.size)
    assertEquals(ScreeningReply.Allow, world.screenCall.execute(IncomingCall("+74951234567", null)))
    assertEquals(emptyList<TemporaryNotice>(), world.shown)
    assertEquals(ScreeningReply.Reject, world.screenCall.execute(IncomingCall("+74951234567", null)))
  }
}
