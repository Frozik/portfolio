package io.github.frozik.callsfilter.screening.adapters.android

import android.content.ContentResolver
import android.database.ContentObserver
import android.database.Cursor
import android.os.Handler
import android.os.HandlerThread
import android.provider.CallLog
import io.github.frozik.callsfilter.screening.application.Diagnostics
import io.github.frozik.callsfilter.screening.application.Level
import io.github.frozik.callsfilter.screening.domain.NameNormalizer

/** Inside the ten seconds a receiver may keep working after the phone goes idle. */
private const val ROW_WAIT_MS = 8_000L

private val INCOMING_TYPES =
  mapOf(
    CallLog.Calls.INCOMING_TYPE to "incoming",
    CallLog.Calls.MISSED_TYPE to "missed",
    CallLog.Calls.REJECTED_TYPE to "rejected",
    CallLog.Calls.BLOCKED_TYPE to "blocked",
  )

private fun Cursor.textColumns(): Map<String, String?> = columnNames.indices
  .filter { getType(it) == Cursor.FIELD_TYPE_STRING || getType(it) == Cursor.FIELD_TYPE_NULL }
  .associate { getColumnName(it) to getString(it) }

/**
 * Where the phone kept the caller's name once a call is over, written to diagnostics. Android hands
 * a screening app no name, so this row is the only witness of how the name came: the network's
 * (`cnip_name`, `asserted_display_name`), the dialer's (`name`, `identify_name`), or a column of
 * the phone's maker. Names stay out of the log; only the columns that hold one go in.
 */
class CallLogRowReport(private val resolver: ContentResolver, private val diagnostics: Diagnostics) {
  fun afterCallEnded(done: () -> Unit) {
    val endedAt = System.currentTimeMillis()
    val newestBefore = newestId() ?: 0L
    val thread = HandlerThread("call-log-row").apply { start() }
    val handler = Handler(thread.looper)
    var finished = false
    lateinit var observer: ContentObserver

    fun finish() {
      if (!finished) {
        finished = true
        resolver.unregisterContentObserver(observer)
        thread.quitSafely()
        done()
      }
    }

    fun check() {
      val row = rowAfter(newestBefore) ?: return
      if (claim(row.id)) {
        report(row, endedAt)
      }
      finish()
    }
    observer =
      object : ContentObserver(handler) {
        override fun onChange(selfChange: Boolean) {
          check()
        }
      }
    resolver.registerContentObserver(CallLog.Calls.CONTENT_URI, true, observer)
    handler.post(::check)
    handler.postDelayed({
      if (!finished) {
        diagnostics.log(Level.INFO, "call-log", "row-not-written", mapOf("waited-ms" to ROW_WAIT_MS.toString()))
        finish()
      }
    }, ROW_WAIT_MS)
  }

  private data class Row(val id: Long, val type: Int, val presentation: Int, val isBusinessCall: String, val text: Map<String, String?>)

  private fun newestId(): Long? = query(null) { cursor -> if (cursor.moveToFirst()) cursor.long(CallLog.Calls._ID) else null }

  private fun rowAfter(id: Long): Row? = query(id) { cursor ->
    if (!cursor.moveToFirst()) {
      null
    } else {
      Row(
        id = cursor.long(CallLog.Calls._ID),
        type = cursor.int(CallLog.Calls.TYPE),
        presentation = cursor.int(CallLog.Calls.NUMBER_PRESENTATION),
        isBusinessCall = cursor.getColumnIndex(IS_BUSINESS_CALL).takeIf { it >= 0 }?.let { cursor.getInt(it).toString() } ?: "absent",
        text = cursor.textColumns(),
      )
    }
  }

  private fun <T> query(afterId: Long?, read: (Cursor) -> T?): T? = try {
    resolver.query(
      CallLog.Calls.CONTENT_URI,
      null,
      afterId?.let { "${CallLog.Calls._ID} > ?" },
      afterId?.let { arrayOf(it.toString()) },
      "${CallLog.Calls._ID} DESC",
    )?.use(read)
  } catch (denied: SecurityException) {
    null
  }

  private fun report(row: Row, endedAt: Long) {
    val kind = INCOMING_TYPES[row.type] ?: return
    val networkName = row.text[CNAP_NAME_COLUMN] ?: row.text[ASSERTED_NAME_COLUMN]
    val dialerName = row.text[CallLog.Calls.CACHED_NAME]
    diagnostics.log(
      Level.INFO,
      "call-log",
      "row-names",
      mapOf(
        "type" to kind,
        "name-columns" to nameColumns(row.text).joinToString(",").ifEmpty { "none" },
        "presentation" to row.presentation.toString(),
        "is-business-call" to row.isBusinessCall,
        "dialer-name-is-network-name" to
          if (networkName == null || dialerName == null) "n/a" else (NameNormalizer.normalize(networkName) == NameNormalizer.normalize(dialerName)).toString(),
        "written-after-ms" to (System.currentTimeMillis() - endedAt).toString(),
      ),
    )
  }

  private companion object {
    const val IS_BUSINESS_CALL = "is_business_call"

    /** The phone says «idle» once per SIM; the row is reported once. */
    @Volatile var reportedId = 0L

    @Synchronized fun claim(id: Long): Boolean = (id > reportedId).also { if (it) reportedId = id }
  }
}
