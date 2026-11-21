package io.github.frozik.callsfilter.screening.adapters.android

import android.os.Build
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
    runtime.diagnostics.log(Level.INFO, "screening", "call-details", detailsOf(callDetails))
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

  /**
   * What the system handed over about the caller, without the name or the number. Android gives a
   * screening app no caller name at all (only the default dialer sees it); logged so that a phone
   * or an Android version that does pass it shows up at once.
   */
  private fun detailsOf(details: Call.Details): Map<String, String> = buildMap {
    put("sdk", Build.VERSION.SDK_INT.toString())
    put("number", (details.handle != null).toString())
    put("number-presentation", details.handlePresentation.toString())
    put("network-name", (!details.callerDisplayName.isNullOrBlank()).toString())
    put("network-name-presentation", details.callerDisplayNamePresentation.toString())
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      put("contact-name", (!details.contactDisplayName.isNullOrBlank()).toString())
      put("verstat", details.callerNumberVerificationStatus.toString())
      put("screened-after-ms", (System.currentTimeMillis() - details.creationTimeMillis).toString())
    }
    put("extras", details.extras?.keySet()?.sorted()?.joinToString(",").orEmpty())
    put("intent-extras", details.intentExtras?.keySet()?.sorted()?.joinToString(",").orEmpty())
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
