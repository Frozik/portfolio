package io.github.frozik.callsfilter.screening

import io.github.frozik.callsfilter.screening.adapters.android.nameColumns
import org.junit.Assert.assertEquals
import org.junit.Test

class CallLogNameColumnsTest {
  @Test
  fun aRowNamesTheColumnsThatHoldTheCallersNameAndNotThePlaceOrTheNumber() {
    val row =
      mapOf(
        "number" to "+79615396021",
        "formatted_number" to "+7 961 539-60-21",
        "geocoded_location" to "Россия",
        "countryiso" to "RU",
        "name" to "IP Kiselev V.S.: IT",
        "cnip_name" to "IP Kiselev V.S.: IT",
        "identify_name" to null,
        "asserted_display_name" to null,
        "subscription_component_name" to "com.android.phone/com.android.services.telephony.TelephonyConnectionService",
      )
    assertEquals(listOf("cnip_name", "name"), nameColumns(row))
  }

  @Test
  fun aMakersOwnColumnWithANameShowsUpToo() {
    assertEquals(listOf("oplus_data1"), nameColumns(mapOf("oplus_data1" to "Pizza Napoli", "number" to "+31201234567")))
  }
}
