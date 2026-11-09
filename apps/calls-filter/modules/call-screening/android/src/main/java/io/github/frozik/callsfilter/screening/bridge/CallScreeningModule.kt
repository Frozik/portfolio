package io.github.frozik.callsfilter.screening.bridge

import android.app.role.RoleManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import io.github.frozik.callsfilter.screening.adapters.android.CALL_SCREENED_ACTION
import io.github.frozik.callsfilter.screening.adapters.android.ScreeningRuntime

private const val ROLE_REQUEST = 4_201
private const val CALL_SCREENED_EVENT = "onCallScreened"
private const val E2E_COMMAND_EVENT = "onE2eCommand"

/** The JavaScript side's only door into the service: publishing rules, reading what happened. */
class CallScreeningModule : Module() {
  private var pendingRole: Promise? = null
  private var receiver: BroadcastReceiver? = null
  private val e2e = E2eChannel { id, payload -> sendEvent(E2E_COMMAND_EVENT, mapOf("id" to id, "payload" to payload)) }

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "the module runs inside the app" }

  private val screening: ScreeningRuntime
    get() = ScreeningRuntime.of(context)

  override fun definition() = ModuleDefinition {
    Name("CallScreening")

    Events(CALL_SCREENED_EVENT, E2E_COMMAND_EVENT)

    OnStartObserving {
      val listener =
        object : BroadcastReceiver() {
          override fun onReceive(context: Context, intent: Intent) {
            sendEvent(CALL_SCREENED_EVENT, emptyMap<String, Any>())
          }
        }
      ContextCompat.registerReceiver(context, listener, IntentFilter(CALL_SCREENED_ACTION), ContextCompat.RECEIVER_NOT_EXPORTED)
      receiver = listener
    }

    OnStopObserving {
      receiver?.let(context::unregisterReceiver)
      receiver = null
    }

    serviceFunctions { screening }

    languageFunctions { context }

    phoneFunctions { context }

    e2eFunctions({ context }, e2e)

    Function("holdsScreeningRole") {
      context.getSystemService(RoleManager::class.java)?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true
    }

    AsyncFunction("requestScreeningRole") { promise: Promise ->
      val roles = context.getSystemService(RoleManager::class.java)
      val activity = appContext.currentActivity
      if (roles == null || activity == null || !roles.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
        promise.resolve(false)
        return@AsyncFunction
      }
      if (roles.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
        promise.resolve(true)
        return@AsyncFunction
      }
      pendingRole = promise
      activity.startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), ROLE_REQUEST)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == ROLE_REQUEST) {
        val roles = context.getSystemService(RoleManager::class.java)
        pendingRole?.resolve(roles?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true)
        pendingRole = null
      }
    }
  }
}
