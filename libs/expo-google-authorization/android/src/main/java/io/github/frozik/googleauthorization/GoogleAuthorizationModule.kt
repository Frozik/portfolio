package io.github.frozik.googleauthorization

import android.accounts.Account
import android.app.Activity
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CONSENT_REQUEST = 4_202
private const val GOOGLE_ACCOUNT = "com.google"

/**
 * Google authorization with the accounts Android already has: the system shows the account
 * picker and the consent screen, hands out the access token and renews it. The app never sees
 * a password.
 */
class GoogleAuthorizationModule : Module() {
  private var pendingConsent: Promise? = null

  private val client
    get() = Identity.getAuthorizationClient(requireNotNull(appContext.reactContext) { "the module runs inside the app" })

  private fun authorized(result: AuthorizationResult): Map<String, Any?> =
    mapOf(
      "kind" to "authorized",
      "token" to result.accessToken,
      "account" to result.toGoogleSignInAccount()?.email,
      "grantedScopes" to result.grantedScopes,
    )

  private fun failed(error: Exception): Map<String, Any?> =
    mapOf("kind" to "failed", "code" to (error as? ApiException)?.statusCode, "message" to error.message)

  override fun definition() =
    ModuleDefinition {
      Name("GoogleAuthorization")

      AsyncFunction("authorize") { scopes: List<String>, account: String?, interactive: Boolean, chooseAccount: Boolean, promise: Promise ->
        val request =
          AuthorizationRequest.builder()
            .setRequestedScopes(scopes.map(::Scope))
            .apply {
              if (account != null && !chooseAccount) {
                setAccount(Account(account, GOOGLE_ACCOUNT))
              }
              if (chooseAccount) {
                setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)
              }
            }
            .build()
        client.authorize(request)
          .addOnSuccessListener { result ->
            val consent = result.pendingIntent
            when {
              !result.hasResolution() -> promise.resolve(authorized(result))
              !interactive || consent == null -> promise.resolve(mapOf("kind" to "needs-consent"))
              else -> {
                val activity: Activity? = appContext.currentActivity
                if (activity == null) {
                  promise.resolve(mapOf("kind" to "needs-consent"))
                } else {
                  pendingConsent = promise
                  activity.startIntentSenderForResult(consent.intentSender, CONSENT_REQUEST, null, 0, 0, 0)
                }
              }
            }
          }
          .addOnFailureListener { error -> promise.resolve(failed(error)) }
      }

      OnActivityResult { _, payload ->
        if (payload.requestCode != CONSENT_REQUEST) {
          return@OnActivityResult
        }
        val promise = pendingConsent ?: return@OnActivityResult
        pendingConsent = null
        if (payload.resultCode != Activity.RESULT_OK) {
          promise.resolve(mapOf("kind" to "cancelled"))
          return@OnActivityResult
        }
        try {
          promise.resolve(authorized(client.getAuthorizationResultFromIntent(payload.data)))
        } catch (error: ApiException) {
          promise.resolve(failed(error))
        }
      }

      AsyncFunction("clearToken") { token: String, promise: Promise ->
        client.clearToken(ClearTokenRequest.builder().setToken(token).build())
          .addOnSuccessListener { promise.resolve(true) }
          .addOnFailureListener { promise.resolve(false) }
      }

      AsyncFunction("revoke") { scopes: List<String>, account: String, promise: Promise ->
        client.revokeAccess(
          RevokeAccessRequest.builder().setScopes(scopes.map(::Scope)).setAccount(Account(account, GOOGLE_ACCOUNT)).build(),
        )
          .addOnSuccessListener { promise.resolve(true) }
          .addOnFailureListener { promise.resolve(false) }
      }
    }
}
