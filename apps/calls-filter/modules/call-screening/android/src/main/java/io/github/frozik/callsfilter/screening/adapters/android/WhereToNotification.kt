package io.github.frozik.callsfilter.screening.adapters.android

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import io.github.frozik.callsfilter.screening.R
import io.github.frozik.callsfilter.screening.application.PendingAsk

private const val CHANNEL = "where-to"
private const val NOTIFICATION_ID = 2

/** The shade shows at most three buttons; the last one opens the app's own list. */
private const val GROUP_BUTTONS = 2
private const val SCHEME = "callsfilter"

/** «Where does this number go?»: the most used groups one tap away, the move itself done by the app. */
class WhereToNotification(private val context: Context) {
  private val manager = context.getSystemService(NotificationManager::class.java)

  fun show(ask: PendingAsk) {
    if (manager == null || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      return
    }
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL, context.getString(R.string.calls_filter_where_to_channel), NotificationManager.IMPORTANCE_DEFAULT),
    )
    val builder =
      Notification.Builder(context, CHANNEL)
        .setSmallIcon(R.drawable.calls_filter_shield)
        .setContentTitle(context.getString(R.string.calls_filter_where_to))
        .setContentText(ask.number?.let { "+$it" } ?: ask.networkName)
        .setAutoCancel(true)
        .setContentIntent(open(moveUri(ask, null), 0))
    ask.choices.take(GROUP_BUTTONS).forEachIndexed { index, choice ->
      builder.addAction(Notification.Action.Builder(null, choice.name, open(moveUri(ask, choice.id), index + 1)).build())
    }
    builder.addAction(Notification.Action.Builder(null, context.getString(R.string.calls_filter_where_to_other), open(moveUri(ask, null), GROUP_BUTTONS + 1)).build())
    manager.notify(NOTIFICATION_ID, builder.build())
  }

  private fun moveUri(ask: PendingAsk, group: String?): Uri = Uri.Builder()
    .scheme(SCHEME)
    .authority("move")
    .appendQueryParameter("at", ask.epochMs.toString())
    .apply { group?.let { appendQueryParameter("group", it) } }
    .build()

  private fun open(uri: Uri, requestCode: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  fun dismiss() {
    manager?.cancel(NOTIFICATION_ID)
  }
}
