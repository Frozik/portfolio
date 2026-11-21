package io.github.frozik.callsfilter.screening.domain

enum class NumberType { MOBILE, FIXED_LINE, PREMIUM_RATE, SHARED_COST, VOIP, TOLL_FREE, OTHER }

/** The address-book entry a number belongs to: its key, and how the address book writes it. */
data class CallerContact(val lookupKey: String, val displayName: String)

/** Who is calling, as the number and the address book say it; `number == null` is a hidden number. */
data class Caller(val number: String?, val country: String?, val type: NumberType?, val contact: CallerContact?)
