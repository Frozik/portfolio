package io.github.frozik.callsfilter.screening.adapters.android

import android.content.ComponentName
import android.content.Context
import android.service.quicksettings.TileService

/** One door for the filter's pause: the app, the tile and the notification all go through it, so they agree. */
class PauseControl(private val context: Context, private val state: PreferencesRuntimeState) {
  private val notification = PauseNotification(context)

  /** When the pause ends, or `null` while the filter works. */
  fun pausedUntil(nowEpochMs: Long = System.currentTimeMillis()): Long? = state.pausedUntilEpochMs()?.takeIf { it > nowEpochMs }

  fun pause(untilEpochMs: Long) {
    state.setPausedUntil(untilEpochMs)
    notification.show(untilEpochMs)
    refreshTile()
  }

  fun resume() {
    state.setPausedUntil(null)
    notification.hide()
    refreshTile()
  }

  private fun refreshTile() {
    TileService.requestListeningState(context, ComponentName(context, PauseTileService::class.java))
  }
}
