package io.github.frozik.callsfilter.screening

import io.github.frozik.callsfilter.screening.adapters.android.FileRulesetStore
import io.github.frozik.callsfilter.screening.application.RulesetLoad
import io.github.frozik.callsfilter.screening.domain.Ruleset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import io.github.frozik.callsfilter.screening.wire.Ruleset as WireRuleset

class FileRulesetStoreTest {
  @get:Rule val folder = TemporaryFolder()

  private fun rulesetOf(schema: Int): ByteArray = WireRuleset.newBuilder().setSchema(schema).setHomeCountry("NL").build().toByteArray()

  @Test
  fun readsTheRulesetTheAppPublished() {
    val store = FileRulesetStore(folder.root)
    store.publish(rulesetOf(Ruleset.SCHEMA))

    assertTrue(store.current() is RulesetLoad.Loaded)
  }

  @Test
  fun dropsARulesetOfAnotherSchemaAndWaitsForTheAppToPublishAgain() {
    val store = FileRulesetStore(folder.root)
    store.publish(rulesetOf(Ruleset.SCHEMA + 1))

    assertEquals(RulesetLoad.Missing, store.current())
    assertFalse(folder.root.resolve("ruleset.pb").exists())
  }
}
