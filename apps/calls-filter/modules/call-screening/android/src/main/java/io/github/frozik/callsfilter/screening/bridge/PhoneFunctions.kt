package io.github.frozik.callsfilter.screening.bridge

import android.app.LocaleManager
import android.content.Context
import android.content.Intent
import android.icu.text.TimeZoneNames
import android.icu.util.TimeZone
import android.net.Uri
import android.os.Build
import android.os.LocaleList
import android.provider.ContactsContract
import android.provider.Settings
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import io.github.frozik.callsfilter.screening.adapters.android.PhoneCallerResolver
import io.github.frozik.callsfilter.screening.adapters.android.SystemCallLog
import io.github.frozik.callsfilter.screening.domain.CallerContact
import java.time.Instant
import java.time.ZoneId

private const val SECONDS_PER_MINUTE = 60

/** Cities of a region (Europe/Helsinki), not the legacy aliases (Etc/GMT+3, SystemV/…). */
private val REGION_ZONE = Regex("^(Africa|America|Antarctica|Asia|Atlantic|Australia|Europe|Indian|Pacific)/[^/]+(/[^/]+)?$")

/** The app's language as Android keeps it per app, and the languages of the phone. */
internal fun ModuleDefinitionBuilder.languageFunctions(context: () -> Context) {
  Function("appLanguage") {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context().getSystemService(LocaleManager::class.java)?.applicationLocales?.takeIf { !it.isEmpty }?.get(0)?.toLanguageTag()
    } else {
      null
    }
  }

  Function("setAppLanguage") { tag: String? ->
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context().getSystemService(LocaleManager::class.java)?.applicationLocales =
        if (tag == null) LocaleList.getEmptyLocaleList() else LocaleList.forLanguageTags(tag)
    }
  }

  Function("systemLanguages") {
    val locales =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context().getSystemService(LocaleManager::class.java)?.systemLocales ?: LocaleList.getDefault()
      } else {
        LocaleList.getDefault()
      }
    (0 until locales.size()).map { locales[it].toLanguageTag() }
  }

  Function("timeZones") {
    val locale = context().resources.configuration.locales[0]
    val names = TimeZoneNames.getInstance(locale)
    val now = Instant.now()
    ZoneId.getAvailableZoneIds()
      .filter { id -> REGION_ZONE.matches(id) && TimeZone.getCanonicalID(id) == id }
      .map { id ->
        mapOf(
          "id" to id,
          "city" to (names.getExemplarLocationName(id) ?: id.substringAfterLast('/').replace('_', ' ')),
          "name" to TimeZone.getTimeZone(id).getDisplayName(false, TimeZone.LONG, locale),
          "offsetMinutes" to ZoneId.of(id).rules.getOffset(now).totalSeconds / SECONDS_PER_MINUTE,
        )
      }
  }
}

/** The phone's own call history, its contacts and its settings screens. */
internal fun ModuleDefinitionBuilder.phoneFunctions(context: () -> Context) {
  AsyncFunction("systemCallLog") { sinceEpochMs: Double, limit: Int ->
    val resolver = context().contentResolver
    val contacts = PhoneCallerResolver(resolver)
    // A number calls many times: one address-book lookup per number, not per call.
    val contactOf = mutableMapOf<String, CallerContact?>()
    SystemCallLog(resolver).incoming(sinceEpochMs.toLong(), limit).map { call ->
      val contact = call.rawNumber?.let { raw -> contactOf.getOrPut(raw) { contacts.contactOf(raw) } }
      mapOf(
        "epochMs" to call.epochMs.toDouble(),
        "rawNumber" to call.rawNumber,
        "kind" to call.kind,
        "contactName" to contact?.displayName,
        "contactId" to contact?.lookupKey,
      )
    }
  }

  Function("openContact") { contactId: String ->
    val uri = Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_URI, contactId)
    context().startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  Function("openSettings") { place: String ->
    val current = context()
    val intent =
      when (place) {
        "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, current.packageName)
        "default-apps" -> Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
        "add-account" -> Intent(Settings.ACTION_ADD_ACCOUNT).putExtra(Settings.EXTRA_ACCOUNT_TYPES, arrayOf("com.google"))
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", current.packageName, null))
      }
    current.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}
