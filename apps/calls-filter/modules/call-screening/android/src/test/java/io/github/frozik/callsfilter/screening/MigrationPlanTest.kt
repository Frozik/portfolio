package io.github.frozik.callsfilter.screening

import io.github.frozik.callsfilter.screening.adapters.android.migrationPlan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MigrationPlanTest {
  private val steps = mapOf(1 to "add a column", 2 to "add an index")

  @Test
  fun takesEveryStepFromTheOldVersionToTheNewInOrder() {
    assertEquals(listOf("add a column", "add an index"), migrationPlan(1, 3, steps))
  }

  @Test
  fun needsNoStepWhenTheVersionHoldsStill() {
    assertEquals(emptyList<String>(), migrationPlan(2, 2, steps))
  }

  @Test
  fun hasNoPlanWhenAStepIsMissing() {
    assertNull(migrationPlan(1, 4, steps))
  }
}
