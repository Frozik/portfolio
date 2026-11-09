package io.github.frozik.callsfilter.screening.bridge

import android.content.Context
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

/** The e2e build's command channel, for the JavaScript side: open it, answer a command. */
internal fun ModuleDefinitionBuilder.e2eFunctions(context: () -> Context, channel: E2eChannel) {
  Function("openE2eControl") { channel.open(context().applicationContext) }

  Function("answerE2eCommand") { id: String, json: String -> channel.answer(id, json) }
}
