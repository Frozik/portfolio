package io.github.frozik.callsfilter.screening.adapters.android

import android.content.Context
import io.github.frozik.callsfilter.screening.application.PendingAsk
import io.github.frozik.callsfilter.screening.application.PendingAsks
import io.github.frozik.callsfilter.screening.domain.GroupChoice
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

private const val PREFERENCES = "calls-filter-runtime"
private const val PENDING_ASK = "pending-where-to"

/** An ask older than the longest plausible call belongs to a call whose end the phone never reported. */
private const val MAX_AGE_MS = 2 * 60 * 60 * 1_000L

/** The one ask waiting for the end of the call, kept across the service's process dying in between. */
class PreferencesPendingAsks(context: Context, private val now: () -> Long) : PendingAsks {
  private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  override fun remember(ask: PendingAsk) {
    val choices = JSONArray(ask.choices.map { JSONObject().put("id", it.id).put("name", it.name) })
    val json =
      JSONObject()
        .put("epochMs", ask.epochMs)
        .put("number", ask.number ?: JSONObject.NULL)
        .put("networkName", ask.networkName ?: JSONObject.NULL)
        .put("choices", choices)
    preferences.edit().putString(PENDING_ASK, json.toString()).apply()
  }

  override fun take(): PendingAsk? {
    val stored = preferences.getString(PENDING_ASK, null) ?: return null
    preferences.edit().remove(PENDING_ASK).apply()
    val ask =
      try {
        parse(JSONObject(stored))
      } catch (unreadable: JSONException) {
        return null
      }
    return ask.takeIf { now() - it.epochMs <= MAX_AGE_MS }
  }

  private fun parse(json: JSONObject): PendingAsk {
    val choices = json.getJSONArray("choices")
    return PendingAsk(
      epochMs = json.getLong("epochMs"),
      number = json.optString("number").takeUnless { json.isNull("number") },
      networkName = json.optString("networkName").takeUnless { json.isNull("networkName") },
      choices = (0 until choices.length()).map { choices.getJSONObject(it).let { choice -> GroupChoice(choice.getString("id"), choice.getString("name")) } },
    )
  }
}
