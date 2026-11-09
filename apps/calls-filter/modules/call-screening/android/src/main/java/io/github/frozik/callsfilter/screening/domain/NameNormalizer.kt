package io.github.frozik.callsfilter.screening.domain

import java.text.Normalizer
import java.util.Locale

/**
 * The same normalization the app applies to names and name masks: case, accents and spacing
 * never decide a match, and the breve of «й» stays. The shared fixtures keep this equal to
 * the TypeScript side.
 */
object NameNormalizer {
  private val combiningRanges = listOf(0x0300..0x036f, 0x1ab0..0x1aff, 0x1dc0..0x1dff, 0x20d0..0x20ff, 0xfe20..0xfe2f)
  private const val COMBINING_BREVE = 0x0306
  private const val CYRILLIC_I = 'и'

  /**
   * JavaScript's `\s`, spelled out: Android's regex engine has no `(?U)` flag, and Java's plain
   * `\s` knows only ASCII spaces.
   */
  private val whitespace = Regex("[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]+")

  fun normalize(text: String): String {
    val decomposed = Normalizer.normalize(
      Normalizer.normalize(text, Normalizer.Form.NFKC).lowercase(Locale.ROOT),
      Normalizer.Form.NFD,
    )
    val kept = StringBuilder()
    var index = 0
    while (index < decomposed.length) {
      val codePoint = decomposed.codePointAt(index)
      val keepsBreve = codePoint == COMBINING_BREVE && kept.endsWith(CYRILLIC_I)
      if (!isCombiningMark(codePoint) || keepsBreve) {
        kept.appendCodePoint(codePoint)
      }
      index += Character.charCount(codePoint)
    }
    return Normalizer.normalize(kept, Normalizer.Form.NFC).replace(whitespace, " ").trim()
  }

  private fun isCombiningMark(codePoint: Int): Boolean = combiningRanges.any { codePoint in it }
}
