package io.github.frozik.callsfilter.screening.adapters.android

import io.github.frozik.callsfilter.screening.adapters.proto.Decoded
import io.github.frozik.callsfilter.screening.adapters.proto.RulesetDecoder
import io.github.frozik.callsfilter.screening.adapters.proto.RulesetFailure
import io.github.frozik.callsfilter.screening.application.RulesetLoad
import io.github.frozik.callsfilter.screening.application.RulesetSource
import java.io.File
import java.io.IOException

private const val RULESET_FILE = "ruleset.pb"

/**
 * The ruleset file the app writes and the service reads; replaced atomically, read again only
 * when it changed. One of another schema is deleted: the app compiles the ruleset again from the
 * group book at its next start, so there is nothing to migrate — until then every call passes.
 */
class FileRulesetStore(directory: File) : RulesetSource {
  private val file = File(directory, RULESET_FILE)
  private var cached: Pair<Long, RulesetLoad>? = null

  @Synchronized
  override fun current(): RulesetLoad {
    if (!file.exists()) {
      return RulesetLoad.Missing
    }
    val stamp = file.lastModified() xor file.length()
    cached?.takeIf { it.first == stamp }?.let { return it.second }
    val load =
      try {
        when (val decoded = RulesetDecoder.decode(file.readBytes())) {
          is Decoded.Ok -> RulesetLoad.Loaded(decoded.ruleset)

          is Decoded.Failed ->
            when (val failure = decoded.failure) {
              is RulesetFailure.Unreadable -> RulesetLoad.Failed(failure.reason)

              is RulesetFailure.UnknownSchema -> {
                file.delete()
                RulesetLoad.Missing
              }
            }
        }
      } catch (failure: IOException) {
        RulesetLoad.Failed(failure.message ?: "unreadable file")
      }
    cached = stamp to load
    return load
  }

  @Synchronized
  fun publish(bytes: ByteArray) {
    val pending = File(file.parentFile, "$RULESET_FILE.tmp")
    pending.writeBytes(bytes)
    check(pending.renameTo(file)) { "the ruleset could not replace the previous one" }
    cached = null
  }
}
