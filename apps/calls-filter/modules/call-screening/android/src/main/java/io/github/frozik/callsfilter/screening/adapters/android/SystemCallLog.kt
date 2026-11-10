package io.github.frozik.callsfilter.screening.adapters.android

import android.content.ContentResolver
import android.provider.CallLog

/** An incoming call from Android's own call log: the history from before the app, and beside it. */
data class SystemCall(val epochMs: Long, val rawNumber: String?, val cachedName: String?, val networkName: String?, val kind: String)

/**
 * The name the network sent with the call (CNAP). Android's own call log has no column for it;
 * OnePlus and Oppo keep it in this one, beside the name the dialer writes.
 */
private const val NETWORK_NAME_COLUMN = "cnip_name"

/** Android's call log, read only: incoming, missed, rejected and blocked calls. */
class SystemCallLog(private val resolver: ContentResolver) {
  private val incomingTypes =
    mapOf(
      CallLog.Calls.INCOMING_TYPE to "incoming",
      CallLog.Calls.MISSED_TYPE to "missed",
      CallLog.Calls.REJECTED_TYPE to "rejected",
      CallLog.Calls.BLOCKED_TYPE to "blocked",
    )

  fun incoming(sinceEpochMs: Long, limit: Int): List<SystemCall> = try {
    resolver.query(
      CallLog.Calls.CONTENT_URI,
      null,
      "${CallLog.Calls.DATE} >= ? AND ${CallLog.Calls.TYPE} IN (${incomingTypes.keys.joinToString(",")})",
      arrayOf(sinceEpochMs.toString()),
      "${CallLog.Calls.DATE} DESC",
    )?.use { cursor ->
      buildList {
        while (cursor.moveToNext() && size < limit) {
          add(
            SystemCall(
              epochMs = cursor.long(CallLog.Calls.DATE),
              rawNumber = cursor.string(CallLog.Calls.NUMBER)?.takeIf { it.isNotBlank() },
              cachedName = cursor.string(CallLog.Calls.CACHED_NAME)?.takeIf { it.isNotBlank() },
              networkName = cursor.optionalString(NETWORK_NAME_COLUMN)?.takeIf { it.isNotBlank() },
              kind = incomingTypes[cursor.int(CallLog.Calls.TYPE)] ?: "incoming",
            ),
          )
        }
      }
    } ?: emptyList()
  } catch (denied: SecurityException) {
    emptyList()
  }
}
