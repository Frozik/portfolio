package io.github.frozik.callsfilter.screening.adapters.android

/** Columns whose text has letters but never a caller's name: places, labels, ids, links. */
private val NOT_NAMES =
  setOf(
    "countryiso",
    "geocoded_location",
    "location",
    "numberlabel",
    "subject",
    "transcription",
    "subscription_component_name",
    "phone_account_address",
    "virtual_call_id",
    "photo_uri",
    "lookup_uri",
    "composer_photo_uri",
    "voicemail_uri",
  )

private val LETTER = Regex("\\p{L}")

/**
 * The columns of a call-log row that hold a name, by their names only. Every column is looked at,
 * not a known list, so a maker's own column carrying the caller's name shows up too.
 */
internal fun nameColumns(row: Map<String, String?>): List<String> =
  row.filter { (column, value) -> column !in NOT_NAMES && value != null && LETTER.containsMatchIn(value) }.keys.sorted()
