package io.github.frozik.callsfilter.screening.adapters.android

import android.content.Context
import io.github.frozik.callsfilter.screening.application.AfterDecision
import io.github.frozik.callsfilter.screening.application.AutoReply
import io.github.frozik.callsfilter.screening.application.RejectionSummaries
import io.github.frozik.callsfilter.screening.application.RejectionSummariesAfter
import io.github.frozik.callsfilter.screening.application.ScreenCall
import io.github.frozik.callsfilter.screening.application.TemporaryNotices
import io.github.frozik.callsfilter.screening.application.TemporaryNoticesAfter
import io.github.frozik.callsfilter.screening.application.WhereToAsk

/** The module's composition root: every adapter is built here once per process, and nowhere else. */
class ScreeningRuntime private constructor(context: Context) {
  private val application = context.applicationContext
  private val database = LocalDatabase.of(application)
  val rulesets = FileRulesetStore(application.filesDir)
  val runtimeState = PreferencesRuntimeState(application)
  val pause = PauseControl(application, runtimeState)
  val pendingAsks = PreferencesPendingAsks(application) { System.currentTimeMillis() }
  val whereToNotification = WhereToNotification(application)
  val country = TelephonyNetworkCountry(application)
  val journal = SqliteCallJournal(database) { runtimeState.retentionDays() }
  val diagnostics = SqliteDiagnostics(database) { System.currentTimeMillis() }
  val temporaryNotices = TemporaryNotices(rulesets, runtimeState, TemporaryNotification(application), SystemMomentClock)
  private val calendarEvents = DeviceCalendarEvents(application.contentResolver)
  val summaries =
    RejectionSummaries(
      PreferencesSummaryStore(application),
      SummaryNotification(application),
      AlarmSummaryAlarm(application),
      calendarEvents,
      SystemMomentClock,
    )
  val screenCall =
    ScreenCall(
      rulesets = rulesets,
      callers = PhoneCallerResolver(application.contentResolver),
      journal = journal,
      runtime = runtimeState,
      calendar = calendarEvents,
      country = country,
      clock = SystemMomentClock,
      diagnostics = diagnostics,
      after =
      ScreenedBroadcast(
        application,
        AutoReply(
          SmsManagerSender(application),
          PreferencesAutoReplyLedger(application),
          country,
          diagnostics,
          WhereToAsk(
            pendingAsks,
            TemporaryNoticesAfter(temporaryNotices, RejectionSummariesAfter(summaries, AfterDecision { _, _, _ -> })),
          ),
        ),
      ),
    )

  companion object {
    @Volatile private var instance: ScreeningRuntime? = null

    fun of(context: Context): ScreeningRuntime = instance ?: synchronized(this) { instance ?: ScreeningRuntime(context).also { instance = it } }
  }
}
