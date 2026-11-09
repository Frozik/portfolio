package io.github.frozik.callsfilter.screening.adapters.android

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

private const val DATABASE_NAME = "calls-filter-service.db"
private const val DATABASE_VERSION = 1

/** The service's own database: the call log and the diagnostics, both written only here. */
class LocalDatabase private constructor(context: Context) : SQLiteOpenHelper(context.applicationContext, DATABASE_NAME, null, DATABASE_VERSION) {
  override fun onCreate(database: SQLiteDatabase) {
    database.execSQL(
      """
      CREATE TABLE calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        epoch_ms INTEGER NOT NULL,
        raw_number TEXT,
        number TEXT,
        network_name TEXT,
        contact_name TEXT,
        contact_lookup_key TEXT,
        group_id TEXT NOT NULL,
        verdict TEXT NOT NULL,
        action_source TEXT NOT NULL,
        also_claimed_by TEXT NOT NULL
      )
      """.trimIndent(),
    )
    database.execSQL("CREATE INDEX calls_by_number ON calls (number, epoch_ms)")
    database.execSQL("CREATE INDEX calls_by_time ON calls (epoch_ms)")
    database.execSQL(
      """
      CREATE TABLE diagnostics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        epoch_ms INTEGER NOT NULL,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        event TEXT NOT NULL,
        fields TEXT NOT NULL
      )
      """.trimIndent(),
    )
  }

  override fun onUpgrade(database: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  companion object {
    @Volatile private var instance: LocalDatabase? = null

    fun of(context: Context): LocalDatabase = instance ?: synchronized(this) { instance ?: LocalDatabase(context).also { instance = it } }
  }
}
