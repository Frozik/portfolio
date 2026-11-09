package io.github.frozik.callsfilter.screening.bridge

import android.graphics.Rect
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.inspector.WindowInspector
import org.json.JSONObject

/**
 * Where a view with this `testID` is on screen, read from the app's own windows — the activity's
 * and every sheet's — in a few milliseconds, where a `uiautomator` dump of the screen takes two
 * seconds. Must run on the main thread, as a broadcast's `onReceive` does.
 */
internal object E2eScreen {
  /** React Native's tag for `testID`; looked up by name, as this module cannot see React Native's R. */
  private var testIdTag: Int? = null

  fun locate(testId: String): JSONObject {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return JSONObject().put("ok", false).put("error", "locating views needs Android 10")
    }
    val roots = WindowInspector.getGlobalWindowViews()
    val tag =
      testIdTag ?: roots.firstOrNull()?.let { root ->
        @Suppress("DiscouragedApi") // Once per process, and only in the e2e build.
        root.resources.getIdentifier("react_test_id", "id", root.context.packageName).also { testIdTag = it }
      } ?: 0
    val view = roots.firstNotNullOfOrNull { find(it, tag, testId) }
    val visible = Rect()
    if (view == null || !view.getGlobalVisibleRect(visible)) {
      return JSONObject().put("ok", true).put("result", JSONObject.NULL)
    }
    val place =
      JSONObject()
        .put("left", visible.left)
        .put("top", visible.top)
        .put("right", visible.right)
        .put("bottom", visible.bottom)
        .put("whole", visible.width() == view.width && visible.height() == view.height)
        // React Native keeps `disabled` in the accessibility state, not in View.isEnabled.
        .put("enabled", view.createAccessibilityNodeInfo().isEnabled)
    return JSONObject().put("ok", true).put("result", place)
  }

  private fun find(view: View, tag: Int, testId: String): View? {
    if (tag != 0 && view.isShown && view.getTag(tag) == testId) {
      return view
    }
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        find(view.getChildAt(index), tag, testId)?.let { return it }
      }
    }
    return null
  }
}
