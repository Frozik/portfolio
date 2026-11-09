package io.github.frozik.callsfilter.screening.adapters.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** «Back to usual» in a temporary policy's notice. */
class TemporaryTakeBackReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val group = intent.getStringExtra(GROUP) ?: return
    val setAt = intent.getLongExtra(SET_AT, -1L).takeIf { it >= 0L } ?: return
    ScreeningRuntime.of(context).temporaryNotices.takeBack(group, setAt)
  }

  companion object {
    const val GROUP = "group"
    const val SET_AT = "set-at"
  }
}
