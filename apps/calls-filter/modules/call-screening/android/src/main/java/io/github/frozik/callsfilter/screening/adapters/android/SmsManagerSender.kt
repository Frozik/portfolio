package io.github.frozik.callsfilter.screening.adapters.android

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import io.github.frozik.callsfilter.screening.application.SmsSender

/** Sends the auto-reply through the default SIM; a long text goes as one multipart message. */
class SmsManagerSender(private val context: Context) : SmsSender {
  override fun canSend(): Boolean = context.checkSelfPermission(Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED

  override fun send(rawNumber: String, text: String) {
    val sms =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.getSystemService(SmsManager::class.java) ?: return
      } else {
        @Suppress("DEPRECATION")
        SmsManager.getDefault()
      }
    sms.sendMultipartTextMessage(rawNumber, null, sms.divideMessage(text), null, null)
  }
}
