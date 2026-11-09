package io.github.frozik.callsfilter.screening

import com.lemonappdev.konsist.api.Konsist
import com.lemonappdev.konsist.api.verify.assertTrue
import org.junit.Test

private const val ROOT = "io.github.frozik.callsfilter.screening"

/** The layers of the service, checked the way dependency-cruiser checks the app. */
class ArchitectureTest {
  private val production = Konsist.scopeFromDirectory("apps/calls-filter/modules/call-screening/android/src/main/java")

  @Test
  fun theDomainKnowsNoAndroidNoExpoNoWire() {
    production.files.filter { it.packagee?.name?.startsWith("$ROOT.domain") == true }.assertTrue { file ->
      file.imports.none { import ->
        import.name.startsWith("android.") || import.name.startsWith("expo.") || import.name.startsWith("$ROOT.wire") ||
          import.name.startsWith("$ROOT.application") || import.name.startsWith("$ROOT.adapters") || import.name.startsWith("$ROOT.bridge")
      }
    }
  }

  @Test
  fun theApplicationSeesOnlyTheDomain() {
    production.files.filter { it.packagee?.name?.startsWith("$ROOT.application") == true }.assertTrue { file ->
      file.imports.none { import ->
        import.name.startsWith("android.") || import.name.startsWith("$ROOT.adapters") || import.name.startsWith("$ROOT.bridge") ||
          import.name.startsWith("$ROOT.wire")
      }
    }
  }

  @Test
  fun generatedClassesStayInTheProtoAdapter() {
    production.files.filter { it.packagee?.name?.startsWith("$ROOT.adapters.proto") != true && it.packagee?.name?.startsWith("$ROOT.wire") != true }
      .assertTrue { file -> file.imports.none { it.name.startsWith("$ROOT.wire") } }
  }
}
