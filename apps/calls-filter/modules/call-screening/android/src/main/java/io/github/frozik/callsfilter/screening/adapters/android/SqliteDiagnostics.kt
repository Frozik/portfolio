package io.github.frozik.callsfilter.screening.adapters.android

import android.content.ContentValues
import io.github.frozik.callsfilter.screening.application.Diagnostics
import io.github.frozik.callsfilter.screening.application.Level
import io.github.frozik.callsfilter.screening.domain.Redactor
import org.json.JSONObject

private const val KEPT_ENTRIES = 5_000
private const val KEPT_DAYS_MS = 30L * 86_400_000L

data class DiagnosticsEntry(val epochMs: Long, val level: String, val category: String, val event: String, val fields: Map<String, String>)

/** A ring buffer of what the app and the service did, every field through the redactor first. */
class SqliteDiagnostics(private val database: LocalDatabase, private val now: () -> Long) : Diagnostics {
  var verbose: () -> Boolean = { false }

  override fun log(level: Level, category: String, event: String, fields: Map<String, String>) {
    if (level == Level.DEBUG && !verbose()) {
      return
    }
    val stamp = now()
    val values =
      ContentValues().apply {
        put("epoch_ms", stamp)
        put("level", level.name.lowercase())
        put("category", category)
        put("event", Redactor.redact(event))
        put("fields", JSONObject(fields.mapValues { Redactor.redact(it.value) }).toString())
      }
    val writable = database.writableDatabase
    writable.insert("diagnostics", null, values)
    writable.delete(
      "diagnostics",
      "epoch_ms < ? OR id <= (SELECT MAX(id) FROM diagnostics) - ?",
      arrayOf((stamp - KEPT_DAYS_MS).toString(), KEPT_ENTRIES.toString()),
    )
  }

  fun latest(limit: Int): List<DiagnosticsEntry> = database.readableDatabase.rawQuery(
    "SELECT epoch_ms, level, category, event, fields FROM diagnostics ORDER BY id DESC LIMIT ?",
    arrayOf(limit.toString()),
  ).use { cursor ->
    buildList {
      while (cursor.moveToNext()) {
        val json = JSONObject(cursor.string("fields").orEmpty())
        add(
          DiagnosticsEntry(
            epochMs = cursor.long("epoch_ms"),
            level = cursor.string("level").orEmpty(),
            category = cursor.string("category").orEmpty(),
            event = cursor.string("event").orEmpty(),
            fields = json.keys().asSequence().associateWith { json.getString(it) },
          ),
        )
      }
    }
  }
}
