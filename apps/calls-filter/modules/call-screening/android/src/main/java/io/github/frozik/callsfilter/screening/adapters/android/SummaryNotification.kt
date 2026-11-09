package io.github.frozik.callsfilter.screening.adapters.android

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import io.github.frozik.callsfilter.screening.R
import io.github.frozik.callsfilter.screening.application.PendingSummary
import io.github.frozik.callsfilter.screening.application.SummaryShade

private const val MEETING_CHANNEL = "meeting-summary"
private const val DIGEST_CHANNEL = "digest"
private const val MEETING_ID = 4
private const val DIGEST_ID = 5

/** Turned-away calls told quietly, each kind on its own channel so Android can mute one alone. */
class SummaryNotification(private val context: Context) : SummaryShade {
  private val manager = context.getSystemService(NotificationManager::class.java)

  override fun show(summary: PendingSummary) {
    if (manager == null || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      return
    }
    val resources = context.resources
    val (channel, title) =
      when (summary) {
        is PendingSummary.AfterMeeting -> {
          val title = summary.meeting.title
          MEETING_CHANNEL to
            if (title == null) {
              resources.getQuantityString(R.plurals.calls_filter_summary_meeting, summary.count, summary.count)
            } else {
              resources.getQuantityString(R.plurals.calls_filter_summary_named_meeting, summary.count, title, summary.count)
            }
        }

        is PendingSummary.Digest -> DIGEST_CHANNEL to resources.getQuantityString(R.plurals.calls_filter_summary_digest, summary.count, summary.count)
      }
    manager.createNotificationChannel(
      NotificationChannel(
        channel,
        context.getString(if (channel == MEETING_CHANNEL) R.string.calls_filter_meeting_summary_channel else R.string.calls_filter_digest_channel),
        NotificationManager.IMPORTANCE_LOW,
      ),
    )
    val open =
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
        PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
      }
    val notification =
      Notification.Builder(context, channel)
        .setSmallIcon(R.drawable.calls_filter_shield)
        .setContentTitle(title)
        .setContentText(context.getString(R.string.calls_filter_summary_text))
        .setAutoCancel(true)
        .setContentIntent(open)
        .build()
    val id = if (summary is PendingSummary.AfterMeeting) MEETING_ID else DIGEST_ID
    manager.notify(summary.dueEpochMs.toString(), id, notification)
  }
}
