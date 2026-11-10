package io.github.frozik.callsfilter.screening.bridge

import android.content.Context
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import io.github.frozik.callsfilter.screening.BuildConfig
import io.github.frozik.callsfilter.screening.adapters.android.ScreeningRuntime
import io.github.frozik.callsfilter.screening.application.IncomingCall
import io.github.frozik.callsfilter.screening.application.ScreeningReply

/** The e2e build's command channel, for the JavaScript side: open it, answer a command. */
internal fun ModuleDefinitionBuilder.e2eFunctions(context: () -> Context, channel: E2eChannel) {
  Function("openE2eControl") { channel.open(context().applicationContext) }

  Function("answerE2eCommand") { id: String, json: String -> channel.answer(id, json) }

  // The emulator's modem rings without a name; this hands the service the one a network would send.
  AsyncFunction("screenE2eCall") { rawNumber: String, networkName: String? ->
    check(BuildConfig.E2E) { "only the e2e build screens a call it makes up" }
    val reply = ScreeningRuntime.of(context().applicationContext).screenCall.execute(IncomingCall(rawNumber, networkName))
    if (reply == ScreeningReply.Reject) "rejected" else "allowed"
  }
}
