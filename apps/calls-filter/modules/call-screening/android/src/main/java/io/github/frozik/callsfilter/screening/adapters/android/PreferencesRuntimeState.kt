package io.github.frozik.callsfilter.screening.adapters.android

import android.content.Context
import io.github.frozik.callsfilter.screening.application.RuntimeState

private const val PREFERENCES = "calls-filter-runtime"
private const val PAUSED_UNTIL = "paused-until"
private const val RELEASED_TEMPORARIES = "used-first-pass"
private const val PLACE_PREFIX = "at-place:"
private const val RETENTION_DAYS = "retention-days"

/** Until the app says otherwise: what the app's own default keeps too. */
private const val DEFAULT_RETENTION_DAYS = 90

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

  /** How many days the journal of screened calls is kept, as the app's setting says. */
  fun retentionDays(): Int = preferences.getInt(RETENTION_DAYS, DEFAULT_RETENTION_DAYS)

  fun setRetentionDays(days: Int) {
    preferences.edit().putInt(RETENTION_DAYS, days).apply()
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
