package io.github.frozik.callsfilter.screening.adapters.android

import android.content.ContentValues
import io.github.frozik.callsfilter.screening.application.CallJournal
import io.github.frozik.callsfilter.screening.application.CallRecord
import io.github.frozik.callsfilter.screening.domain.Verdict

private const val DAY_MS = 86_400_000L

class SqliteCallJournal(private val database: LocalDatabase, private val retentionDays: () -> Int) : CallJournal {
  override fun lastRejectedAt(number: String, sinceEpochMs: Long): Long? = database.readableDatabase.rawQuery(
    "SELECT MAX(epoch_ms) FROM calls WHERE number = ? AND epoch_ms >= ? AND verdict IN (?, ?)",
    arrayOf(number, sinceEpochMs.toString(), Verdict.REJECTED.name, Verdict.AWAITING_REPEAT.name),
  ).use { cursor -> if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null }

  override fun record(record: CallRecord) {
    val values =
      ContentValues().apply {
        put("epoch_ms", record.epochMs)
        put("raw_number", record.rawNumber)
        put("number", record.number)
        put("network_name", record.networkName)
        put("contact_name", record.contactName)
        put("contact_lookup_key", record.contactLookupKey)
        put("group_id", record.groupId)
        put("verdict", record.verdict)
        put("action_source", record.actionSource)
        put("also_claimed_by", record.alsoClaimedBy.joinToString(","))
      }
    val writable = database.writableDatabase
    writable.insert("calls", null, values)
    writable.delete("calls", "epoch_ms < ?", arrayOf((record.epochMs - retentionDays() * DAY_MS).toString()))
  }

  fun since(sinceEpochMs: Long, limit: Int): List<CallRecord> = database.readableDatabase.rawQuery(
    "SELECT epoch_ms, raw_number, number, network_name, contact_name, contact_lookup_key, group_id, verdict, action_source, also_claimed_by " +
      "FROM calls WHERE epoch_ms >= ? ORDER BY epoch_ms DESC LIMIT ?",
    arrayOf(sinceEpochMs.toString(), limit.toString()),
  ).use { cursor ->
    buildList {
      while (cursor.moveToNext()) {
        add(
          CallRecord(
            epochMs = cursor.long("epoch_ms"),
            rawNumber = cursor.string("raw_number"),
            number = cursor.string("number"),
            networkName = cursor.string("network_name"),
            contactName = cursor.string("contact_name"),
            contactLookupKey = cursor.string("contact_lookup_key"),
            groupId = cursor.string("group_id").orEmpty(),
            verdict = cursor.string("verdict").orEmpty(),
            actionSource = cursor.string("action_source").orEmpty(),
            alsoClaimedBy = cursor.string("also_claimed_by").orEmpty().split(',').filter(String::isNotEmpty),
          ),
        )
      }
    }
  }
}
