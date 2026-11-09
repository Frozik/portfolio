package io.github.frozik.callsfilter.screening.adapters.android

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.text.format.DateFormat
import io.github.frozik.callsfilter.screening.R

private const val CHANNEL = "pause"
private const val NOTIFICATION_ID = 1

/** While the filter is paused the shade says so, with «Resume» one tap away; it leaves by itself when the pause ends. */
class PauseNotification(private val context: Context) {
  private val manager = context.getSystemService(NotificationManager::class.java)

  fun show(untilEpochMs: Long) {
    if (manager == null || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      return
    }
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL, context.getString(R.string.calls_filter_pause_channel), NotificationManager.IMPORTANCE_LOW),
    )
    val until = DateFormat.getTimeFormat(context).format(untilEpochMs)
    val resume =
      PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, ResumeReceiver::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    val open =
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
        PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
      }
    val notification =
      Notification.Builder(context, CHANNEL)
        .setSmallIcon(R.drawable.calls_filter_shield)
        .setContentTitle(context.getString(R.string.calls_filter_paused_until, until))
        .setContentText(context.getString(R.string.calls_filter_paused_text))
        .setOngoing(true)
        .setContentIntent(open)
        .setTimeoutAfter(untilEpochMs - System.currentTimeMillis())
        .addAction(Notification.Action.Builder(null, context.getString(R.string.calls_filter_resume), resume).build())
        .build()
    manager.notify(NOTIFICATION_ID, notification)
  }

  fun hide() {
    manager?.cancel(NOTIFICATION_ID)
  }
}
