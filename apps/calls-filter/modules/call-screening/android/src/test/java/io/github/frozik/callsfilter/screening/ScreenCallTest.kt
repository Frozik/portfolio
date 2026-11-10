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
import io.github.frozik.callsfilter.screening.domain.Action
import io.github.frozik.callsfilter.screening.domain.Caller
import io.github.frozik.callsfilter.screening.domain.Group
import io.github.frozik.callsfilter.screening.domain.GroupKind
import io.github.frozik.callsfilter.screening.domain.Member
import io.github.frozik.callsfilter.screening.domain.Moment
import io.github.frozik.callsfilter.screening.domain.RepeatPass
import io.github.frozik.callsfilter.screening.domain.Ruleset
import io.github.frozik.callsfilter.screening.domain.TemporaryPolicy
import io.github.frozik.callsfilter.screening.domain.UntilKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private const val NOW = 1_800_000_000_000L
private const val HOUR_MS = 3_600_000L

private fun group(id: String, kind: GroupKind, include: List<Member> = emptyList(), otherwise: Action = Action.PASS, temporary: TemporaryPolicy? = null) =
  Group(id, kind, include, emptyList(), true, otherwise, null, 5, temporary, 0L, "")

private fun ruleset(vararg custom: Group) =
  Ruleset(1, 0L, Long.MAX_VALUE, "NL", custom.toList() + group("my-contacts", GroupKind.MY_CONTACTS) + group("strangers", GroupKind.STRANGERS))

private class Harness(load: RulesetLoad) {
  val records = mutableListOf<CallRecord>()
  val logged = mutableListOf<String>()
  val used = mutableSetOf<String>()
  var pausedUntil: Long? = null
  val screenCall =
    ScreenCall(
      rulesets = { load },
      callers = CallerResolver { call, _ -> Caller(call.rawNumber?.removePrefix("+"), "NL", null, null, null) },
      journal =
      object : CallJournal {
        override fun lastRejectedAt(number: String, sinceEpochMs: Long): Long? =
          records.filter { it.number == number && it.epochMs >= sinceEpochMs && it.verdict != "PASSED" }.maxOfOrNull { it.epochMs }

        override fun record(record: CallRecord) {
          records += record
        }
      },
      runtime =
      object : RuntimeState {
        override fun pausedUntilEpochMs(): Long? = pausedUntil

        override fun temporaryReleased(groupId: String, setAtEpochMs: Long): Boolean = "$groupId@$setAtEpochMs" in used

        override fun releaseTemporary(groupId: String, setAtEpochMs: Long) {
          used += "$groupId@$setAtEpochMs"
        }

        override fun atPlace(placeId: String): Boolean? = null
      },
      calendar = { _, _ -> null },
      country = { "NL" },
      clock = { Moment(NOW, 0L) },
      diagnostics = { level, _, event, _ -> logged += "$level $event" },
      after = AfterDecision { _, _, _ -> },
    )
}

class ScreenCallTest {
  private val spam = group("spam", GroupKind.CUSTOM, listOf(Member.Number(Regex("^7495\\d*$"))), Action.BLOCK)

  @Test
  fun everyCallPassesWhileThereIsNoRuleset() {
    val harness = Harness(RulesetLoad.Missing)
    assertEquals(ScreeningReply.Allow, harness.screenCall.execute(IncomingCall("+74951234567", null)))
    assertEquals(listOf("WARN no-ruleset"), harness.logged)
  }

  @Test
  fun anUnreadableRulesetLetsTheCallThroughAndSaysSo() {
    val harness = Harness(RulesetLoad.Failed("schema 2"))
    assertEquals(ScreeningReply.Allow, harness.screenCall.execute(IncomingCall("+74951234567", null)))
    assertEquals(listOf("ERROR ruleset-unreadable"), harness.logged)
  }

  @Test
  fun aSpamNumberIsRejectedAndWritten() {
    val harness = Harness(RulesetLoad.Loaded(ruleset(spam)))
    assertEquals(ScreeningReply.Reject, harness.screenCall.execute(IncomingCall("+74951234567", null)))
    assertEquals("spam REJECTED", harness.records.single().let { "${it.groupId} ${it.verdict}" })
  }

  @Test
  fun theSecondCallPassesWhenTheGroupLetsARepeatRing() {
    val delivery = group("delivery", GroupKind.CUSTOM, listOf(Member.Number(Regex("^3185\\d*$"))), Action.BLOCK).copy(repeatPass = RepeatPass.Always)
    val harness = Harness(RulesetLoad.Loaded(ruleset(delivery)))
    assertEquals(ScreeningReply.Reject, harness.screenCall.execute(IncomingCall("+31851234567", null)))
    assertEquals(ScreeningReply.Allow, harness.screenCall.execute(IncomingCall("+31851234567", null)))
    assertEquals(listOf("AWAITING_REPEAT", "PASSED_AS_REPEAT"), harness.records.map { it.verdict })
  }

  @Test
  fun aFirstPassPolicyIsUsedUpByTheCallItLetThrough() {
    val temporary = TemporaryPolicy(Action.PASS, UntilKind.FIRST_PASS, NOW + HOUR_MS, NOW - HOUR_MS)
    val harness = Harness(RulesetLoad.Loaded(ruleset(spam.copy(temporary = temporary))))
    assertEquals(ScreeningReply.Allow, harness.screenCall.execute(IncomingCall("+74951234567", null)))
    assertEquals(ScreeningReply.Reject, harness.screenCall.execute(IncomingCall("+74951234567", null)))
  }

  @Test
  fun aPauseLetsEverythingThrough() {
    val harness = Harness(RulesetLoad.Loaded(ruleset(spam)))
    harness.pausedUntil = NOW + HOUR_MS
    assertEquals(ScreeningReply.Allow, harness.screenCall.execute(IncomingCall("+74951234567", null)))
    assertTrue(harness.records.single().verdict == "PAUSED")
  }

  @Test
  fun aHiddenNumberIsAStrangerWithoutANumber() {
    val harness = Harness(RulesetLoad.Loaded(ruleset(spam)))
    assertEquals(ScreeningReply.Allow, harness.screenCall.execute(IncomingCall(null, null)))
    assertEquals("strangers", harness.records.single().groupId)
  }
}
