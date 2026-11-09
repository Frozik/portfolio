package io.github.frozik.callsfilter.screening.adapters.android

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** «Resume» in the pause notification. */
class ResumeReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    ScreeningRuntime.of(context).pause.resume()
  }
}
