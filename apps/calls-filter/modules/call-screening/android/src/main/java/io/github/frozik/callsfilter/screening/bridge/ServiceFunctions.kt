package io.github.frozik.callsfilter.screening.bridge

import android.util.Base64
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import io.github.frozik.callsfilter.screening.adapters.android.ScreeningRuntime
import io.github.frozik.callsfilter.screening.application.CallRecord
import io.github.frozik.callsfilter.screening.application.Level

private fun recordMap(record: CallRecord): Map<String, Any?> = mapOf(
  "epochMs" to record.epochMs.toDouble(),
  "rawNumber" to record.rawNumber,
  "number" to record.number,
  "networkName" to record.networkName,
  "contactName" to record.contactName,
  "contactLookupKey" to record.contactLookupKey,
  "groupId" to record.groupId,
  "verdict" to record.verdict,
  "actionSource" to record.actionSource,
  "alsoClaimedBy" to record.alsoClaimedBy,
)

/** What the app tells the screening service, and what it reads back from it. */
internal fun ModuleDefinitionBuilder.serviceFunctions(screening: () -> ScreeningRuntime) {
  Function("publishRuleset") { base64: String ->
    val runtime = screening()
    runtime.rulesets.publish(Base64.decode(base64, Base64.NO_WRAP))
    runtime.temporaryNotices.refresh()
    runtime.summaries.deliver()
  }

  AsyncFunction("calls") { sinceEpochMs: Double, limit: Int ->
    screening().journal.since(sinceEpochMs.toLong(), limit).map(::recordMap)
  }

  Function("diagnostics") { limit: Int ->
    screening().diagnostics.latest(limit).map {
      mapOf("epochMs" to it.epochMs.toDouble(), "level" to it.level, "category" to it.category, "event" to it.event, "fields" to it.fields)
    }
  }

  Function("log") { level: String, category: String, event: String, fields: Map<String, String> ->
    screening().diagnostics.log(Level.valueOf(level.uppercase()), category, event, fields)
  }

  Function("setVerboseDiagnostics") { untilEpochMs: Double? ->
    val until = untilEpochMs?.toLong()
    screening().diagnostics.verbose = { until != null && System.currentTimeMillis() < until }
  }

  Function("pausedUntil") { screening().pause.pausedUntil()?.toDouble() }

  Function("setPausedUntil") { untilEpochMs: Double? ->
    if (untilEpochMs == null) screening().pause.resume() else screening().pause.pause(untilEpochMs.toLong())
  }

  Function("setRetentionDays") { days: Int -> screening().runtimeState.setRetentionDays(days) }

  Function("dismissWhereTo") { screening().whereToNotification.dismiss() }

  Function("setAtPlace") { placeId: String, inside: Boolean? -> screening().runtimeState.setAtPlace(placeId, inside) }

  Function("atPlace") { placeId: String -> screening().runtimeState.atPlace(placeId) }

  Function("knownPlaces") { screening().runtimeState.knownPlaces().toList() }

  Function("releasedTemporaries") { screening().runtimeState.releasedTemporaries().toList() }

  Function("networkCountry") { screening().country.current() }

  Function("simCountry") { screening().country.simCountry() }
}
