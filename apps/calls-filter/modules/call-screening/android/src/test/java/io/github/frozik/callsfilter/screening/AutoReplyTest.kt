package io.github.frozik.callsfilter.screening

import io.github.frozik.callsfilter.screening.application.AUTO_REPLY_COOLDOWN_MS
import io.github.frozik.callsfilter.screening.application.AfterDecision
import io.github.frozik.callsfilter.screening.application.AutoReply
import io.github.frozik.callsfilter.screening.application.AutoReplyLedger
import io.github.frozik.callsfilter.screening.application.CallRecord
import io.github.frozik.callsfilter.screening.application.SmsSender
import io.github.frozik.callsfilter.screening.domain.Action
import io.github.frozik.callsfilter.screening.domain.ActionNow
import io.github.frozik.callsfilter.screening.domain.ActionSource
import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.Group
import io.github.frozik.callsfilter.screening.domain.GroupKind
import io.github.frozik.callsfilter.screening.domain.Ruleset
import io.github.frozik.callsfilter.screening.domain.Verdict
import org.junit.Assert.assertEquals
import org.junit.Test

private const val NOW = 1_800_000_000_000L
private const val TEXT = "In a meeting, will call back"

private fun record(verdict: Verdict = Verdict.REJECTED, contact: String? = "lookup-1", epochMs: Long = NOW) =
  CallRecord(epochMs, "+31612345678", "31612345678", null, "Mum", contact, "work", verdict.name, "SCHEDULED", emptyList())

private val RULESET = Ruleset(1, 0L, Long.MAX_VALUE, "NL", emptyList(), emptyMap())

private fun decided(record: CallRecord, text: String) = Decision(
  Group("work", GroupKind.CUSTOM, emptyList(), emptyList(), false, Action.BLOCK, null, 5, null, 0L, text),
  emptyList(),
  ActionNow(Action.BLOCK, ActionSource.OTHERWISE),
  Verdict.valueOf(record.verdict),
)

private fun Phone.call(record: CallRecord, text: String = TEXT) = autoReply.handle(record, decided(record, text), RULESET)

private class Phone(var roaming: Boolean = false, var permitted: Boolean = true) {
  val sent = mutableListOf<String>()
  val ledger = mutableMapOf<String, Long>()
  val passedOn = mutableListOf<CallRecord>()
  val autoReply =
    AutoReply(
      sender =
      object : SmsSender {
        override fun canSend(): Boolean = permitted

        override fun send(rawNumber: String, text: String) {
          sent += "$rawNumber: $text"
        }
      },
      ledger =
      object : AutoReplyLedger {
        override fun lastSentAt(number: String): Long? = ledger[number]

        override fun markSent(number: String, epochMs: Long) {
          ledger[number] = epochMs
        }
      },
      roaming = { roaming },
      diagnostics = { _, _, _, _ -> },
      next = AfterDecision { record, _, _ -> passedOn += record },
    )
}

class AutoReplyTest {
  @Test
  fun aContactTurnedAwayGetsTheGroupsText() {
    val phone = Phone()
    phone.call(record())
    assertEquals(listOf("+31612345678: $TEXT"), phone.sent)
  }

  @Test
  fun aStrangerNeverHearsBackSoASpammerLearnsNothing() {
    val phone = Phone()
    phone.call(record(contact = null))
    assertEquals(emptyList<String>(), phone.sent)
  }

  @Test
  fun aCallLetThroughOrAGroupWithoutTextSendsNothing() {
    val phone = Phone()
    phone.call(record(verdict = Verdict.PASSED))
    phone.call(record(), "  ")
    assertEquals(emptyList<String>(), phone.sent)
  }

  @Test
  fun aRedialWithinTheCooldownGetsNoSecondMessage() {
    val phone = Phone()
    phone.call(record())
    phone.call(record(verdict = Verdict.AWAITING_REPEAT, epochMs = NOW + AUTO_REPLY_COOLDOWN_MS - 1))
    phone.call(record(epochMs = NOW + AUTO_REPLY_COOLDOWN_MS))
    assertEquals(2, phone.sent.size)
  }

  @Test
  fun nothingIsSentWhenRoamingOrWithoutThePermission() {
    val roaming = Phone(roaming = true)
    roaming.call(record())
    val forbidden = Phone(permitted = false)
    forbidden.call(record())
    assertEquals(emptyList<String>(), roaming.sent + forbidden.sent)
  }

  @Test
  fun theCallGoesOnToTheNextStepWhateverHappens() {
    val phone = Phone(roaming = true)
    phone.call(record())
    assertEquals(1, phone.passedOn.size)
  }
}
