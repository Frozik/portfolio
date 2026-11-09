package io.github.frozik.callsfilter.screening.adapters.android

import android.content.Context
import io.github.frozik.callsfilter.screening.application.AutoReplyLedger

private const val PREFERENCES = "calls-filter-auto-replies"

/** When each number last got an auto-reply; a fact of this phone only. */
class PreferencesAutoReplyLedger(context: Context) : AutoReplyLedger {
  private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  override fun lastSentAt(number: String): Long? = preferences.getLong(number, 0L).takeIf { it > 0L }

  override fun markSent(number: String, epochMs: Long) {
    preferences.edit().putLong(number, epochMs).apply()
  }
}
