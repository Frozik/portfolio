package io.github.frozik.callsfilter.screening.adapters.android

import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.text.format.DateFormat
import io.github.frozik.callsfilter.screening.R

/** The tile pauses the filter for the most common stretch; the app offers the others. */
private const val TILE_PAUSE_MS = 60 * 60 * 1_000L

/** The Quick Settings tile: lit while the filter works, a tap pauses it for an hour or resumes it. */
class PauseTileService : TileService() {
  private val pause: PauseControl
    get() = ScreeningRuntime.of(this).pause

  override fun onStartListening() {
    super.onStartListening()
    render()
  }

  override fun onClick() {
    super.onClick()
    if (pause.pausedUntil() == null) {
      pause.pause(System.currentTimeMillis() + TILE_PAUSE_MS)
    } else {
      pause.resume()
    }
    render()
  }

  private fun render() {
    val tile = qsTile ?: return
    val until = pause.pausedUntil()
    tile.state = if (until == null) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
    tile.label = getString(R.string.calls_filter_tile)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.subtitle =
        if (until == null) {
          getString(R.string.calls_filter_tile_on)
        } else {
          getString(R.string.calls_filter_tile_until, DateFormat.getTimeFormat(this).format(until))
        }
    }
    tile.updateTile()
  }
}
