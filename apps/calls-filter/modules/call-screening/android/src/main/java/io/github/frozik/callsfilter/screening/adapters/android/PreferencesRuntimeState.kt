package io.github.frozik.callsfilter.screening.adapters.android

import android.content.Context
import io.github.frozik.callsfilter.screening.application.RuntimeState

private const val PREFERENCES = "calls-filter-runtime"
private const val PAUSED_UNTIL = "paused-until"
private const val RELEASED_TEMPORARIES = "used-first-pass"
private const val PLACE_PREFIX = "at-place:"

/** The pause and the released temporary policies: facts of this phone only, owned by the service. */
class PreferencesRuntimeState(context: Context) : RuntimeState {
  private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  override fun pausedUntilEpochMs(): Long? = preferences.getLong(PAUSED_UNTIL, 0L).takeIf { it > 0L }

  fun setPausedUntil(epochMs: Long?) {
    preferences.edit().apply { if (epochMs == null) remove(PAUSED_UNTIL) else putLong(PAUSED_UNTIL, epochMs) }.apply()
  }

  override fun temporaryReleased(groupId: String, setAtEpochMs: Long): Boolean = "$groupId@$setAtEpochMs" in preferences.getStringSet(RELEASED_TEMPORARIES, emptySet()).orEmpty()

  override fun releaseTemporary(groupId: String, setAtEpochMs: Long) {
    val released = preferences.getStringSet(RELEASED_TEMPORARIES, emptySet()).orEmpty() + "$groupId@$setAtEpochMs"
    preferences.edit().putStringSet(RELEASED_TEMPORARIES, released).apply()
  }

  fun releasedTemporaries(): Set<String> = preferences.getStringSet(RELEASED_TEMPORARIES, emptySet()).orEmpty()

  override fun atPlace(placeId: String): Boolean? {
    val key = PLACE_PREFIX + placeId
    return if (preferences.contains(key)) preferences.getBoolean(key, false) else null
  }

  /** The places a geofence has said something about. */
  fun knownPlaces(): Set<String> = preferences.all.keys.filter { it.startsWith(PLACE_PREFIX) }.map { it.removePrefix(PLACE_PREFIX) }.toSet()

  /** What a geofence said about a place; `null` forgets it, so the place stops counting. */
  fun setAtPlace(placeId: String, inside: Boolean?) {
    val key = PLACE_PREFIX + placeId
    preferences.edit().apply { if (inside == null) remove(key) else putBoolean(key, inside) }.apply()
  }
}
