package io.github.frozik.callsfilter.screening.application

import io.github.frozik.callsfilter.screening.domain.Decision
import io.github.frozik.callsfilter.screening.domain.Ruleset

/** A contact turned away during a meeting hears from the app at most this often. */
const val AUTO_REPLY_COOLDOWN_MS = 3 * 60 * 60 * 1_000L

interface SmsSender {
  fun canSend(): Boolean

  fun send(rawNumber: String, text: String)
}

interface AutoReplyLedger {
  fun lastSentAt(number: String): Long?

  fun markSent(number: String, epochMs: Long)
}

fun interface Roaming {
  fun isRoaming(): Boolean
}

/**
 * The group's SMS to a contact it turned away. Only contacts: answering a spammer proves the
 * number is alive. Never when roaming, and once per cooldown so a redial does not get a second one.
 */
class AutoReply(
  private val sender: SmsSender,
  private val ledger: AutoReplyLedger,
  private val roaming: Roaming,
  private val diagnostics: Diagnostics,
  private val next: AfterDecision,
) : AfterDecision {
  override fun handle(record: CallRecord, decision: Decision, ruleset: Ruleset) {
    reply(record, decision)
    next.handle(record, decision, ruleset)
  }

  private fun reply(record: CallRecord, decision: Decision) {
    val number = record.number ?: return
    val rawNumber = record.rawNumber ?: return
    val text = decision.group.autoReplyText
    if (text.isBlank() || record.contactLookupKey == null || decision.letsThrough) {
      return
    }
    val last = ledger.lastSentAt(number)
    if (last != null && record.epochMs - last < AUTO_REPLY_COOLDOWN_MS) {
      return
    }
    if (roaming.isRoaming()) {
      diagnostics.log(Level.INFO, "sms", "skipped-roaming", emptyMap())
      return
    }
    if (!sender.canSend()) {
      diagnostics.log(Level.WARN, "sms", "no-permission", emptyMap())
      return
    }
    sender.send(rawNumber, text)
    ledger.markSent(number, record.epochMs)
    diagnostics.log(Level.INFO, "sms", "auto-reply-sent", mapOf("group" to record.groupId))
  }
}
