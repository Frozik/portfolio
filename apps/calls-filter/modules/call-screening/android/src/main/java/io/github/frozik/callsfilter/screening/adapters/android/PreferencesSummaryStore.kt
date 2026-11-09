package io.github.frozik.callsfilter.screening.adapters.android

import android.content.Context
import io.github.frozik.callsfilter.screening.application.Meeting
import io.github.frozik.callsfilter.screening.application.PendingSummary
import io.github.frozik.callsfilter.screening.application.SummaryStore
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

private const val PREFERENCES = "calls-filter-runtime"
private const val PENDING_SUMMARIES = "pending-summaries"
private const val MEETING = "meeting"
private const val DIGEST = "digest"

/** Summaries not told yet, kept across the service's process dying before they are due. */
class PreferencesSummaryStore(context: Context) : SummaryStore {
  private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  override fun pending(): List<PendingSummary> {
    val stored = preferences.getString(PENDING_SUMMARIES, null) ?: return emptyList()
    return try {
      val array = JSONArray(stored)
      (0 until array.length()).mapNotNull { parse(array.getJSONObject(it)) }
    } catch (unreadable: JSONException) {
      emptyList()
    }
  }

  override fun save(pending: List<PendingSummary>) {
    preferences.edit().putString(PENDING_SUMMARIES, JSONArray(pending.map(::json)).toString()).apply()
  }

  private fun json(summary: PendingSummary): JSONObject = when (summary) {
    is PendingSummary.AfterMeeting ->
      JSONObject()
        .put("kind", MEETING)
        .put("title", summary.meeting.title ?: JSONObject.NULL)
        .put("end", summary.meeting.endEpochMs)
        .put("count", summary.count)

    is PendingSummary.Digest -> JSONObject().put("kind", DIGEST).put("due", summary.dueEpochMs).put("count", summary.count)
  }

  private fun parse(json: JSONObject): PendingSummary? = when (json.getString("kind")) {
    MEETING ->
      PendingSummary.AfterMeeting(
        Meeting(json.optString("title").takeUnless { json.isNull("title") }, json.getLong("end")),
        json.getInt("count"),
      )

    DIGEST -> PendingSummary.Digest(json.getLong("due"), json.getInt("count"))

    else -> null
  }
}
