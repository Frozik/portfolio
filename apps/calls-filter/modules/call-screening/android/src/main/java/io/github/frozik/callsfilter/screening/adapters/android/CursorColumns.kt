package io.github.frozik.callsfilter.screening.adapters.android

import android.database.Cursor

/** Columns read by name, so a projection reordered never shifts what a field reads. */
internal fun Cursor.long(column: String): Long = getLong(getColumnIndexOrThrow(column))

internal fun Cursor.int(column: String): Int = getInt(getColumnIndexOrThrow(column))

internal fun Cursor.string(column: String): String? = getString(getColumnIndexOrThrow(column))
