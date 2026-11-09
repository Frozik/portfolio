package io.github.frozik.callsfilter.screening.adapters.android

import android.content.ContentResolver
import android.net.Uri
import android.provider.ContactsContract
import com.google.i18n.phonenumbers.NumberParseException
import com.google.i18n.phonenumbers.PhoneNumberUtil
import com.google.i18n.phonenumbers.PhoneNumberUtil.PhoneNumberType
import io.github.frozik.callsfilter.screening.application.CallerResolver
import io.github.frozik.callsfilter.screening.application.IncomingCall
import io.github.frozik.callsfilter.screening.domain.Caller
import io.github.frozik.callsfilter.screening.domain.CallerContact
import io.github.frozik.callsfilter.screening.domain.NameNormalizer
import io.github.frozik.callsfilter.screening.domain.NumberType

private val NON_DIGITS = Regex("\\D")

/**
 * The call's number through the numbering plan (as dialled from home) and the address book.
 * A contact is keyed by its contact id, the same key the app's address book adapter reads.
 */
class PhoneCallerResolver(private val resolver: ContentResolver) : CallerResolver {
  private val util = PhoneNumberUtil.getInstance()

  override fun resolve(call: IncomingCall, homeCountry: String): Caller {
    val raw = call.rawNumber?.takeIf { it.any(Char::isDigit) }
      ?: return Caller(null, null, null, call.networkName?.let(NameNormalizer::normalize), null)
    val parsed =
      try {
        util.parse(raw, homeCountry)
      } catch (failure: NumberParseException) {
        null
      }
    val digits = parsed?.let { util.format(it, PhoneNumberUtil.PhoneNumberFormat.E164).removePrefix("+") } ?: raw.replace(NON_DIGITS, "")
    return Caller(
      number = digits,
      country = parsed?.let(util::getRegionCodeForNumber)?.takeIf { it != "ZZ" },
      type = parsed?.let { type(util.getNumberType(it)) },
      networkName = call.networkName?.takeIf { it.isNotBlank() }?.let(NameNormalizer::normalize),
      contact = contactOf(raw),
    )
  }

  private fun type(type: PhoneNumberType): NumberType = when (type) {
    PhoneNumberType.MOBILE -> NumberType.MOBILE
    PhoneNumberType.FIXED_LINE, PhoneNumberType.FIXED_LINE_OR_MOBILE -> NumberType.FIXED_LINE
    PhoneNumberType.PREMIUM_RATE -> NumberType.PREMIUM_RATE
    PhoneNumberType.SHARED_COST -> NumberType.SHARED_COST
    PhoneNumberType.VOIP -> NumberType.VOIP
    PhoneNumberType.TOLL_FREE -> NumberType.TOLL_FREE
    else -> NumberType.OTHER
  }

  /** The address-book entry a number belongs to, or `null` (also without the permission). */
  fun contactOf(raw: String): CallerContact? = try {
    resolver.query(
      Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(raw)),
      arrayOf(ContactsContract.PhoneLookup.CONTACT_ID, ContactsContract.PhoneLookup.DISPLAY_NAME),
      null,
      null,
      null,
    )?.use { cursor ->
      if (!cursor.moveToFirst()) {
        null
      } else {
        val displayName = cursor.getString(1).orEmpty()
        CallerContact(cursor.getString(0).orEmpty(), NameNormalizer.normalize(displayName), displayName)
      }
    }
  } catch (denied: SecurityException) {
    null
  }
}
