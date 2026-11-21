package io.github.frozik.callsfilter.screening.adapters.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager

/** The phone going idle ends the call: a waiting «where does this number go?» is asked, the call-log row reported. */
class CallEndedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.getStringExtra(TelephonyManager.EXTRA_STATE) != TelephonyManager.EXTRA_STATE_IDLE) {
      return
    }
    val runtime = ScreeningRuntime.of(context)
    runtime.pendingAsks.take()?.let(runtime.whereToNotification::show)
    val pending = goAsync()
    runtime.callLogRows.afterCallEnded(pending::finish)
  }
}
