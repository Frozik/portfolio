package io.github.frozik.callsfilter.screening.adapters.android

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import io.github.frozik.callsfilter.screening.application.SummaryAlarm

/** An inexact wake-up when the next summary is due: a minute late is fine, no exact-alarm permission. */
class AlarmSummaryAlarm(private val context: Context) : SummaryAlarm {
  private val manager = context.getSystemService(AlarmManager::class.java)

  override fun wakeAt(epochMs: Long?) {
    val intent = PendingIntent.getBroadcast(context, 0, Intent(context, SummaryReceiver::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    if (epochMs == null) {
      manager?.cancel(intent)
    } else {
      manager?.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, epochMs, intent)
    }
  }
}
