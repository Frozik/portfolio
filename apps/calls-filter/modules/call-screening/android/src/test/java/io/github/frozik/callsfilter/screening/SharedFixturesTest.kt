package io.github.frozik.callsfilter.screening

import io.github.frozik.callsfilter.screening.adapters.proto.Decoded
import io.github.frozik.callsfilter.screening.adapters.proto.RulesetDecoder
import io.github.frozik.callsfilter.screening.domain.CalendarRule
import io.github.frozik.callsfilter.screening.domain.Caller
import io.github.frozik.callsfilter.screening.domain.CallerContact
import io.github.frozik.callsfilter.screening.domain.DecisionContext
import io.github.frozik.callsfilter.screening.domain.Moment
import io.github.frozik.callsfilter.screening.domain.MomentFacts
import io.github.frozik.callsfilter.screening.domain.NameNormalizer
import io.github.frozik.callsfilter.screening.domain.NumberType
import io.github.frozik.callsfilter.screening.domain.decide
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Base64

/** The answers TypeScript wrote into `src/fixtures/screening.json`, given again by this service. */
class SharedFixturesTest {
  private val fixtures =
    JSONObject(checkNotNull(javaClass.classLoader).getResourceAsStream("screening.json").bufferedReader().readText())

  private fun JSONObject.optionalString(key: String): String? = if (isNull(key)) null else getString(key)

  private fun callerOf(json: JSONObject): Caller {
    val contactName = json.optionalString("contactName")
    val lookupKey = json.optionalString("contactLookupKey")
    val number = json.optionalString("number")
    return Caller(
      number = number,
      country = if (number == null) null else json.optionalString("country"),
      type = if (number == null) null else NumberType.valueOf(json.getString("type").uppercase().replace('-', '_')),
      networkName = json.optionalString("networkName")?.let(NameNormalizer::normalize),
      contact = if (contactName != null && lookupKey != null) CallerContact(lookupKey, NameNormalizer.normalize(contactName), contactName) else null,
    )
  }

  private fun verdictName(verdict: String): String = verdict.uppercase().replace('-', '_')

  @Test
  fun everyScenarioGetsTheAnswerTypeScriptGave() {
    val scenarios = fixtures.getJSONArray("screening")
    val mismatches = mutableListOf<String>()
    for (index in 0 until scenarios.length()) {
      val scenario = scenarios.getJSONObject(index)
      val decoded = RulesetDecoder.decode(Base64.getDecoder().decode(scenario.getString("ruleset")))
      check(decoded is Decoded.Ok) { "${scenario.getString("name")}: $decoded" }
      val country = scenario.optionalString("networkCountry")
      val facts =
        object : MomentFacts {
          override val networkCountry: String? = country

          override fun inEvent(rule: CalendarRule, minute: Long): Boolean = rule.bakedEvents.any { it.contains(minute) }

          override fun atPlace(placeId: String): Boolean? = scenario.getJSONObject("places").let { if (it.has(placeId)) it.getBoolean(placeId) else null }
        }
      val lastRejected = if (scenario.isNull("lastRejectedAtEpochMs")) null else scenario.getLong("lastRejectedAtEpochMs")
      val decision =
        decide(
          decoded.ruleset,
          callerOf(scenario.getJSONObject("caller")),
          Moment(scenario.getLong("instantEpochMs"), scenario.getLong("localMinute")),
          DecisionContext(paused = scenario.getBoolean("paused"), lastRejectedAtEpochMs = lastRejected, facts = facts),
        )
      val expected = scenario.getJSONObject("expected")
      val got = "${decision.group.id} ${decision.verdict}"
      val want = "${expected.getString("group")} ${verdictName(expected.getString("verdict"))}"
      if (got != want) {
        mismatches += "${scenario.getString("name")}: expected $want, got $got"
      }
    }
    assertEquals(emptyList<String>(), mismatches)
  }

  @Test
  fun namesNormalizeAsInTypeScript() {
    val names = fixtures.getJSONArray("names")
    for (index in 0 until names.length()) {
      val name = names.getJSONObject(index)
      assertEquals(name.getString("raw"), name.getString("normalized"), NameNormalizer.normalize(name.getString("raw")))
    }
  }
}
