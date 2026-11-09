package io.github.frozik.callsfilter.screening.adapters.android

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.icu.text.DateFormat
import android.icu.text.DisplayContext
import io.github.frozik.callsfilter.screening.R
import io.github.frozik.callsfilter.screening.application.TemporaryNotice
import io.github.frozik.callsfilter.screening.application.TemporaryShade
import io.github.frozik.callsfilter.screening.domain.Action
import io.github.frozik.callsfilter.screening.domain.GroupKind
import io.github.frozik.callsfilter.screening.domain.UntilKind

private const val CHANNEL = "temporary"
private const val NOTIFICATION_ID = 3
private const val DAY_MS = 86_400_000L

/** One quiet notice per group a temporary policy holds — «Delivery: ✅ let through until Thu 18:00» — with «Back to usual». */
class TemporaryNotification(private val context: Context) : TemporaryShade {
  private val manager = context.getSystemService(NotificationManager::class.java)

  override fun show(notices: List<TemporaryNotice>) {
    if (manager == null) {
      return
    }
    val shown = notices.map { it.groupId }.toSet()
    manager.activeNotifications
      .filter { it.id == NOTIFICATION_ID && it.tag !in shown }
      .forEach { manager.cancel(it.tag, NOTIFICATION_ID) }
    if (notices.isEmpty() || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      return
    }
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL, context.getString(R.string.calls_filter_temporary_channel), NotificationManager.IMPORTANCE_MIN),
    )
    notices.forEach { manager.notify(it.groupId, NOTIFICATION_ID, notification(it)) }
  }

  private fun notification(notice: TemporaryNotice): Notification {
    val takeBack =
      PendingIntent.getBroadcast(
        context,
        notice.groupId.hashCode(),
        Intent(context, TemporaryTakeBackReceiver::class.java)
          .putExtra(TemporaryTakeBackReceiver.GROUP, notice.groupId)
          .putExtra(TemporaryTakeBackReceiver.SET_AT, notice.setAtEpochMs),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
    val open =
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
        PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
      }
    return Notification.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.calls_filter_shield)
      .setContentTitle(title(notice))
      .setContentText(until(notice))
      .setOngoing(true)
      .setContentIntent(open)
      .setTimeoutAfter(notice.untilEpochMs - System.currentTimeMillis())
      .addAction(Notification.Action.Builder(null, context.getString(R.string.calls_filter_take_back), takeBack).build())
      .build()
  }

  private fun title(notice: TemporaryNotice): String {
    val name =
      when (notice.groupKind) {
        GroupKind.CUSTOM -> notice.groupName
        GroupKind.MY_CONTACTS -> context.getString(R.string.calls_filter_group_my_contacts)
        GroupKind.STRANGERS -> context.getString(R.string.calls_filter_group_strangers)
      }
    val action =
      when (notice.action) {
        Action.PASS -> R.string.calls_filter_temporary_pass
        Action.BLOCK -> R.string.calls_filter_temporary_block
      }
    return context.getString(action, name)
  }

  private fun until(notice: TemporaryNotice): String = when (notice.until) {
    UntilKind.FIRST_PASS -> context.getString(R.string.calls_filter_temporary_first_pass)
    UntilKind.INSTANT -> context.getString(R.string.calls_filter_temporary_until, moment(notice.untilEpochMs))
    UntilKind.END_OF_EVENT -> context.getString(R.string.calls_filter_temporary_end_of_event, moment(notice.untilEpochMs))
  }

  /** «18:00» within a day, «Thu 18:00» beyond it, in the app's language. */
  private fun moment(epochMs: Long): String {
    val locale = context.resources.configuration.locales[0]
    val skeleton = if (epochMs - System.currentTimeMillis() < DAY_MS) "jmm" else "EEEjmm"
    return DateFormat.getInstanceForSkeleton(skeleton, locale)
      .apply { setContext(DisplayContext.CAPITALIZATION_FOR_MIDDLE_OF_SENTENCE) }
      .format(epochMs)
  }
}
