package io.github.frozik.callsfilter.screening.adapters.android

import android.content.ContentResolver
import android.database.Cursor
import android.database.sqlite.SQLiteException
import android.provider.CallLog
import io.github.frozik.callsfilter.screening.application.NameMemory
import io.github.frozik.callsfilter.screening.application.RememberedNames
import io.github.frozik.callsfilter.screening.domain.NameNormalizer

/** An incoming call from Android's own call log: the history from before the app, and beside it. */
data class SystemCall(val epochMs: Long, val rawNumber: String?, val networkName: String?, val dialerName: String?, val kind: String)

/**
 * The name the network sent with the call (CNAP). Android's own call log has no column for it;
 * OnePlus and Oppo keep it in this one, beside the name the dialer writes.
 */
private const val CNAP_NAME_COLUMN = "cnip_name"

/** The caller's name the network vouched for (Android 14: verified business calls). */
private const val ASSERTED_NAME_COLUMN = "asserted_display_name"

/** The caller ID OnePlus and Oppo dialers look a stranger's number up by. */
private const val IDENTIFIED_NAME_COLUMN = "identify_name"

/** How far back a number's calls are searched for a name it once came with. */
private const val REMEMBERED_CALLS = 20

private fun Cursor.name(column: String): String? = optionalString(column)?.takeIf { it.isNotBlank() }

private fun Cursor.networkName(): String? = name(CNAP_NAME_COLUMN) ?: name(ASSERTED_NAME_COLUMN)

/** The dialer copies the operator's name into its own column too; that is not a second name. */
private fun Cursor.dialerName(networkName: String?): String? = (name(CallLog.Calls.CACHED_NAME) ?: name(IDENTIFIED_NAME_COLUMN))
  ?.takeUnless { networkName != null && NameNormalizer.normalize(it) == NameNormalizer.normalize(networkName) }

/** Android's call log, read only: incoming, missed, rejected and blocked calls, and the names they came with. */
class SystemCallLog(private val resolver: ContentResolver) : NameMemory {
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
          val networkName = cursor.networkName()
          add(
            SystemCall(
              epochMs = cursor.long(CallLog.Calls.DATE),
              rawNumber = cursor.string(CallLog.Calls.NUMBER)?.takeIf { it.isNotBlank() },
              networkName = networkName,
              dialerName = cursor.dialerName(networkName),
              kind = incomingTypes[cursor.int(CallLog.Calls.TYPE)] ?: "incoming",
            ),
          )
        }
      }
    } ?: emptyList()
  } catch (denied: SecurityException) {
    emptyList()
  }

  /** The newest name of each kind among the number's latest calls; nothing without the permission. */
  override fun of(number: String): RememberedNames = try {
    resolver.query(
      CallLog.Calls.CONTENT_URI,
      null,
      "${CallLog.Calls.NUMBER} = ? OR ${CallLog.Calls.CACHED_NORMALIZED_NUMBER} = ?",
      arrayOf("+$number", "+$number"),
      "${CallLog.Calls.DATE} DESC",
    )?.use { cursor ->
      generateSequence { if (cursor.moveToNext()) cursor.networkName().let { RememberedNames(it, cursor.dialerName(it)) } else null }
        .take(REMEMBERED_CALLS)
        .fold(RememberedNames.NONE) { kept, call -> RememberedNames(kept.networkName ?: call.networkName, kept.dialerName ?: call.dialerName) }
    } ?: RememberedNames.NONE
  } catch (denied: SecurityException) {
    RememberedNames.NONE
  } catch (broken: SQLiteException) {
    throw IllegalStateException("the call log refused the query", broken)
  }
}
