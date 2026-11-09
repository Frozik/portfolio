package io.github.frozik.callsfilter.screening.adapters.android

import android.content.Context
import android.content.Intent
import io.github.frozik.callsfilter.screening.application.AfterDecision
import io.github.frozik.callsfilter.screening.application.CallRecord
import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.Ruleset

const val CALL_SCREENED_ACTION = "io.github.frozik.callsfilter.CALL_SCREENED"

/** Tells the app a call was written to the journal, so an open screen shows it at once. */
class ScreenedBroadcast(private val context: Context, private val next: AfterDecision) : AfterDecision {
  override fun handle(record: CallRecord, decision: Decision, ruleset: Ruleset) {
    context.sendBroadcast(Intent(CALL_SCREENED_ACTION).setPackage(context.packageName))
    next.handle(record, decision, ruleset)
  }
}
