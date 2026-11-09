package io.github.frozik.callsfilter.screening.adapters.android

import android.content.Context
import android.telephony.TelephonyManager
import io.github.frozik.callsfilter.screening.application.NetworkCountry
import io.github.frozik.callsfilter.screening.application.Roaming
import java.util.Locale

private const val PREFERENCES = "calls-filter-runtime"
private const val LAST_COUNTRY = "last-network-country"

/** The country of the network the phone is on; in flight mode, the last one it saw. */
class TelephonyNetworkCountry(context: Context) :
  NetworkCountry,
  Roaming {
  private val telephony = context.getSystemService(TelephonyManager::class.java)
  private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  override fun current(): String? {
    val seen = telephony?.networkCountryIso?.takeIf { it.isNotBlank() }?.uppercase(Locale.ROOT)
    if (seen != null) {
      preferences.edit().putString(LAST_COUNTRY, seen).apply()
      return seen
    }
    return preferences.getString(LAST_COUNTRY, null)
  }

  override fun isRoaming(): Boolean = telephony?.isNetworkRoaming == true

  fun simCountry(): String? = telephony?.simCountryIso?.takeIf { it.isNotBlank() }?.uppercase(Locale.ROOT)
}
