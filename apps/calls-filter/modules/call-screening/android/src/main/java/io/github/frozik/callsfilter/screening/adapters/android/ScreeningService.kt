package io.github.frozik.callsfilter.screening.adapters.android

import android.telecom.Call
import android.telecom.CallScreeningService
import io.github.frozik.callsfilter.screening.application.IncomingCall
import io.github.frozik.callsfilter.screening.application.Level
import io.github.frozik.callsfilter.screening.application.ScreenCall
import io.github.frozik.callsfilter.screening.application.ScreeningReply
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/** Well inside the system's five seconds; a decision takes a few milliseconds (phase 0). */
private const val SCREENING_BUDGET_MS = 2_000L

/** The system's door into the app: one call in, exactly one answer out, fail-open. */
class ScreeningService : CallScreeningService() {
  private val worker = Executors.newSingleThreadExecutor()

  override fun onScreenCall(callDetails: Call.Details) {
    val runtime = ScreeningRuntime.of(this)
    val call =
      IncomingCall(
        rawNumber = callDetails.handle?.schemeSpecificPart,
        networkName = callDetails.callerDisplayName?.takeIf { it.isNotBlank() },
      )
    val reply =
      try {
        worker.submit<ScreeningReply> { runtime.screenCall.execute(call) }.get(SCREENING_BUDGET_MS, TimeUnit.MILLISECONDS)
      } catch (late: TimeoutException) {
        runtime.diagnostics.log(Level.ERROR, "screening", "over-budget", emptyMap())
        ScreeningReply.Allow
      } catch (failure: ExecutionException) {
        runtime.diagnostics.log(Level.ERROR, "screening", "failed", mapOf("reason" to failure.cause.toString()))
        ScreeningReply.Allow
      }
    respondToCall(callDetails, responseOf(reply))
  }

  private fun responseOf(reply: ScreeningReply): CallResponse = when (reply) {
    ScreeningReply.Allow -> CallResponse.Builder().build()
    ScreeningReply.Reject -> CallResponse.Builder().setDisallowCall(true).setRejectCall(true).build()
  }

  override fun onDestroy() {
    worker.shutdown()
    super.onDestroy()
  }
}
