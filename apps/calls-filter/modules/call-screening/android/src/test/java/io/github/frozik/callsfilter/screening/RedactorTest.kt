package io.github.frozik.callsfilter.screening

import io.github.frozik.callsfilter.screening.domain.Redactor
import org.junit.Assert.assertEquals
import org.junit.Test

class RedactorTest {
  @Test
  fun aPhoneNumberKeepsItsFirstTwoAndLastFourDigits() {
    assertEquals("call from +31 ••• •4567", Redactor.redact("call from +31 612 34567"))
    assertEquals("79•••••4567", Redactor.redact("79211254567"))
  }

  @Test
  fun aShortNumberOrACounterStaysAsItIs() {
    assertEquals("merged 3 changes, 214 rules", Redactor.redact("merged 3 changes, 214 rules"))
  }

  @Test
  fun aLinkKeepsOnlyItsHost() {
    assertEquals(
      "HTTP 401 https://calendar.google.com/…",
      Redactor.redact("HTTP 401 https://calendar.google.com/calendar/ical/secret123/private-abc/basic.ics"),
    )
  }
}
