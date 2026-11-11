package io.github.ciphravault.vaultfiles

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File

/** A vault is a few megabytes; a file far past that is not one, and is not read into memory. */
private const val MAX_INCOMING_BYTES = 64L * 1024 * 1024
private const val VAULT_EXTENSION = ".pwv"
private const val BACKUP_FOLDER = "backup"

/**
 * Files to and from other apps: a file Android hands over ("Open with", "Share") and the backup
 * folder beside the app's own data, where file managers on a computer find it.
 */
class VaultFilesModule : Module() {
  private var pending: Intent? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "the module runs inside the app" }

  /** `Android/data/<package>/backup`: the app's own corner of shared storage, no permission needed. */
  private fun backupDirectory(): File = File(context.getExternalFilesDir(null)?.parentFile ?: context.filesDir, BACKUP_FOLDER)

  /** Only a plain file name in the folder: never a path out of it. */
  private fun backupFile(name: String): File? =
    if (name.endsWith(VAULT_EXTENSION) && File(name).name == name && !name.startsWith(".")) File(backupDirectory(), name) else null

  private fun streamOf(intent: Intent): Uri? =
    when (intent.action) {
      Intent.ACTION_VIEW -> intent.data
      Intent.ACTION_SEND ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }
      else -> null
    }

  private fun displayName(uri: Uri): String =
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    } ?: uri.lastPathSegment ?: "vault$VAULT_EXTENSION"

  private fun read(uri: Uri): ByteArray? =
    context.contentResolver.openInputStream(uri)?.use { input ->
      val output = ByteArrayOutputStream()
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      var total = 0L
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        total += count
        if (total > MAX_INCOMING_BYTES) return@use null
        output.write(buffer, 0, count)
      }
      output.toByteArray()
    }

  override fun definition() =
    ModuleDefinition {
      Name("VaultFiles")

      Events("onIncomingFile")

      OnNewIntent { intent ->
        if (streamOf(intent) != null) {
          pending = intent
          sendEvent("onIncomingFile", emptyMap<String, Any>())
        }
      }

      AsyncFunction("takeIncomingFile") { ->
        val activity = appContext.currentActivity
        val intent = pending ?: activity?.intent
        pending = null
        val uri = intent?.let(::streamOf) ?: return@AsyncFunction null
        // Taken once: a lock reloads the app in the same activity, and must not open the file again.
        activity?.intent = Intent(Intent.ACTION_MAIN)
        runCatching { read(uri)?.let { bytes -> mapOf("name" to displayName(uri), "bytes" to bytes) } }.getOrNull()
      }

      Function("backupLocation") { -> backupDirectory().absolutePath }

      AsyncFunction("listBackups") { ->
        backupDirectory()
          .listFiles()
          .orEmpty()
          .filter { file -> file.isFile && file.name.endsWith(VAULT_EXTENSION) }
          .map { file ->
            mapOf<String, Any>("name" to file.name, "modifiedAt" to file.lastModified().toDouble(), "size" to file.length().toDouble())
          }
      }

      AsyncFunction("readBackup") { name: String ->
        backupFile(name)?.takeIf(File::isFile)?.let { file -> runCatching { file.readBytes() }.getOrNull() }
      }

      AsyncFunction("writeBackup") { name: String, bytes: ByteArray ->
        val target = backupFile(name) ?: return@AsyncFunction false
        runCatching {
          backupDirectory().mkdirs()
          // Written aside and moved in: a full disk never leaves half a vault under the real name.
          val partial = File(backupDirectory(), ".$name.part")
          partial.writeBytes(bytes)
          partial.renameTo(target) || run {
            partial.delete()
            false
          }
        }.getOrDefault(false)
      }

      AsyncFunction("deleteBackup") { name: String ->
        backupFile(name)?.delete() ?: false
      }
    }
}
