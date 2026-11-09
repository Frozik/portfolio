package io.github.frozik.callsfilter.screening.bridge

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.core.content.ContextCompat
import io.github.frozik.callsfilter.screening.BuildConfig
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val E2E_ACTION = "io.github.frozik.callsfilter.E2E"
private const val PAYLOAD_EXTRA = "payload"

/** Only the shell and the system hold it: no app on the phone can send the channel a command. */
private const val SENDER_PERMISSION = "android.permission.DUMP"

/** Android gives a background broadcast a minute; an answer later than this is a hung app. */
private const val REPLY_TIMEOUT_MS = 45_000L
private const val NO_REPLY = """{"ok":false,"error":"the app did not answer"}"""

/**
 * The e2e build's command channel: `adb shell am broadcast` hands a command (base64 JSON) to the
 * app's JavaScript, whose answer becomes the broadcast's result data. A release build never opens
 * it: `BuildConfig.E2E` is set only when the APK is built for the emulator's tests.
 */
private fun encoded(json: String): String = Base64.encodeToString(json.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)

internal class E2eChannel(private val deliver: (id: String, payload: String) -> Unit) {
  private val pending = ConcurrentHashMap<String, BroadcastReceiver.PendingResult>()
  private val main = Handler(Looper.getMainLooper())
  private var receiver: BroadcastReceiver? = null

  fun open(context: Context): Boolean {
    if (!BuildConfig.E2E) {
      return false
    }
    if (receiver == null) {
      val listener =
        object : BroadcastReceiver() {
          override fun onReceive(context: Context, intent: Intent) {
            val payload = String(Base64.decode(intent.getStringExtra(PAYLOAD_EXTRA).orEmpty(), Base64.DEFAULT), Charsets.UTF_8)
            val id = UUID.randomUUID().toString()
            pending[id] = goAsync()
            main.postDelayed({ answer(id, NO_REPLY) }, REPLY_TIMEOUT_MS)
            deliver(id, payload)
          }
        }
      ContextCompat.registerReceiver(context, listener, IntentFilter(E2E_ACTION), SENDER_PERMISSION, null, ContextCompat.RECEIVER_EXPORTED)
      receiver = listener
    }
    return true
  }

  fun answer(id: String, json: String) {
    val result = pending.remove(id) ?: return
    result.resultCode = Activity.RESULT_OK
    result.resultData = encoded(json)
    result.finish()
  }
}
