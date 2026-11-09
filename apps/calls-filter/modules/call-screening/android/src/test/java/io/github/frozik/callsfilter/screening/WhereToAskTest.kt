package io.github.frozik.callsfilter.screening

import io.github.frozik.callsfilter.screening.application.AfterDecision
import io.github.frozik.callsfilter.screening.application.CallRecord
import io.github.frozik.callsfilter.screening.application.PendingAsk
import io.github.frozik.callsfilter.screening.application.PendingAsks
import io.github.frozik.callsfilter.screening.application.WhereToAsk
import io.github.frozik.callsfilter.screening.domain.Action
import io.github.frozik.callsfilter.screening.domain.ActionNow
import io.github.frozik.callsfilter.screening.domain.ActionSource
import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.Group
import io.github.frozik.callsfilter.screening.domain.GroupChoice
import io.github.frozik.callsfilter.screening.domain.GroupKind
import io.github.frozik.callsfilter.screening.domain.Ruleset
import io.github.frozik.callsfilter.screening.domain.Verdict
import org.junit.Assert.assertEquals
import org.junit.Test

private val CHOICES = listOf(GroupChoice("spam", "Spam"), GroupChoice("delivery", "Delivery"))

private fun ruleset(whereTo: List<GroupChoice> = CHOICES) = Ruleset(1, 0L, Long.MAX_VALUE, "NL", emptyList(), emptyMap(), whereTo)

private fun decision(kind: GroupKind, verdict: Verdict) = Decision(
  Group(kind.name, kind, emptyList(), emptyList(), false, Action.PASS, null, 5, null, 0L, ""),
  emptyList(),
  ActionNow(Action.PASS, ActionSource.OTHERWISE),
  verdict,
)

private fun record(number: String? = "31201234567", networkName: String? = null) =
  CallRecord(1L, number?.let { "+$it" }, number, networkName, null, null, "strangers", "PASSED", "OTHERWISE", emptyList())

private class Shade {
  val remembered = mutableListOf<PendingAsk>()
  val ask =
    WhereToAsk(
      object : PendingAsks {
        override fun remember(ask: PendingAsk) {
          remembered += ask
        }

        override fun take(): PendingAsk? = remembered.removeLastOrNull()
      },
      AfterDecision { _, _, _ -> },
    )
}

class WhereToAskTest {
  @Test
  fun aStrangersCallThatRangThroughWaitsForTheQuestion() {
    val shade = Shade()
    shade.ask.handle(record(), decision(GroupKind.STRANGERS, Verdict.PASSED), ruleset())
    assertEquals(listOf(PendingAsk(1L, "31201234567", null, CHOICES)), shade.remembered)
  }

  @Test
  fun aRejectedCallOrACallerOfAGroupIsNotAsked() {
    val shade = Shade()
    shade.ask.handle(record(), decision(GroupKind.STRANGERS, Verdict.REJECTED), ruleset())
    shade.ask.handle(record(), decision(GroupKind.CUSTOM, Verdict.PASSED), ruleset())
    assertEquals(emptyList<PendingAsk>(), shade.remembered)
  }

  @Test
  fun nothingIsAskedWhenTheUserTurnedItOffOrTheCallerHasNoNumberAndNoName() {
    val shade = Shade()
    shade.ask.handle(record(), decision(GroupKind.STRANGERS, Verdict.PASSED), ruleset(whereTo = emptyList()))
    shade.ask.handle(record(number = null), decision(GroupKind.STRANGERS, Verdict.PASSED), ruleset())
    assertEquals(emptyList<PendingAsk>(), shade.remembered)
  }

  @Test
  fun aHiddenNumberWithAnOperatorNameIsAskedByTheName() {
    val shade = Shade()
    shade.ask.handle(record(number = null, networkName = "Courier"), decision(GroupKind.STRANGERS, Verdict.PAUSED), ruleset())
    assertEquals("Courier", shade.remembered.single().networkName)
  }
}
