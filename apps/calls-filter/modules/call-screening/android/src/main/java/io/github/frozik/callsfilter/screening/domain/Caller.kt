package io.github.frozik.callsfilter.screening.domain

enum class NumberType { MOBILE, FIXED_LINE, PREMIUM_RATE, SHARED_COST, VOIP, TOLL_FREE, OTHER }

/** `name` is normalized for matching; `displayName` is how the address book writes it. */
data class CallerContact(val lookupKey: String, val name: String, val displayName: String)

/** Who is calling, as the call and the address book say it; `number == null` is a hidden number. */
data class Caller(val number: String?, val country: String?, val type: NumberType?, val networkName: String?, val contact: CallerContact?)
