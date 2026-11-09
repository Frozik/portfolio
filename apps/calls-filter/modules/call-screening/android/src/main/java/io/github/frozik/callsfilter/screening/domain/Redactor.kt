package io.github.frozik.callsfilter.screening.domain

/**
 * The privacy filter every diagnostics entry passes before it is stored: the journal may be
 * shared to a messenger, so phone numbers keep only their first two and last four digits,
 * and links keep only their host (an iCal link is a secret: it reads the whole calendar).
 */
object Redactor {
  private const val KEPT_HEAD = 2
  private const val KEPT_TAIL = 4
  private const val SHORTEST_NUMBER = KEPT_HEAD + KEPT_TAIL + 1
  private const val MASK = '•'
  private val number = Regex("\\+?\\d[\\d \\-()]{5,}\\d")
  private val link = Regex("(https?|webcal)://([^/\\s?#]+)[^\\s]*")

  fun redact(text: String): String = text
    .replace(link) { "${it.groupValues[1]}://${it.groupValues[2]}/…" }
    .replace(number) { maskNumber(it.value) }

  private fun maskNumber(value: String): String {
    val digits = value.count(Char::isDigit)
    if (digits < SHORTEST_NUMBER) {
      return value
    }
    var seen = 0
    return value.map { character ->
      if (!character.isDigit()) {
        character
      } else {
        seen += 1
        if (seen <= KEPT_HEAD || seen > digits - KEPT_TAIL) character else MASK
      }
    }.joinToString("")
  }
}
