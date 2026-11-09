package io.github.frozik.callsfilter.screening.adapters.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** The wake-up a due summary set. */
class SummaryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    ScreeningRuntime.of(context).summaries.deliver()
  }
}
