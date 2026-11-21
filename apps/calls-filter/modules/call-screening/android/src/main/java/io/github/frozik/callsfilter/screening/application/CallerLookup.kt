package io.github.frozik.callsfilter.screening.application

import io.github.frozik.callsfilter.screening.domain.Caller
import io.github.frozik.callsfilter.screening.domain.NameNormalizer

/** The caller with every name the phone has for them, and the operator's name as it was written. */
data class IdentifiedCall(val caller: Caller, val networkName: String?)

private fun sourceOf(live: String?, remembered: String?): String = when {
  live != null -> "call"
  remembered != null -> "call-log"
  else -> "none"
}

/**
 * Who is calling: the number and the address book, then the names. The operator's and the dialer's
 * names usually reach the phone after the call was screened, so the number's earlier calls supply
 * them; the name the call itself came with outranks theirs.
 */
class CallerLookup(private val resolver: CallerResolver, private val memory: NameMemory, private val diagnostics: Diagnostics) {
  /** A call log a phone's maker changed must cost the names only, never the decision. */
  private fun rememberedNames(number: String): RememberedNames = try {
    memory.of(number)
  } catch (refused: IllegalArgumentException) {
    unreadable(refused)
  } catch (broken: IllegalStateException) {
    unreadable(broken)
  }

  private fun unreadable(failure: RuntimeException): RememberedNames {
    diagnostics.log(Level.WARN, "screening", "call-log-unreadable", mapOf("reason" to failure.toString()))
    return RememberedNames.NONE
  }

  fun identify(call: IncomingCall, homeCountry: String): IdentifiedCall {
    val resolved = resolver.resolve(call, homeCountry)
    val remembered = resolved.number?.let(::rememberedNames) ?: RememberedNames.NONE
    val networkName = call.networkName ?: remembered.networkName
    val normalizedNetworkName = networkName?.let(NameNormalizer::normalize)
    val dialerName =
      remembered.dialerName
        ?.let(NameNormalizer::normalize)
        ?.takeIf { resolved.contact == null && it != normalizedNetworkName }
    diagnostics.log(
      Level.INFO,
      "screening",
      "caller-names",
      mapOf(
        "operator" to sourceOf(call.networkName, remembered.networkName),
        "dialer" to sourceOf(null, dialerName),
        "contact" to (resolved.contact != null).toString(),
      ),
    )
    return IdentifiedCall(resolved.copy(networkName = normalizedNetworkName, dialerName = dialerName), networkName)
  }
}
