package io.github.frozik.e2eagent;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.UiAutomation;
import android.graphics.Rect;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.Configurator;
import androidx.test.uiautomator.StaleObjectException;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * The agent's one «test»: it serves until told to stop. Each request is a JSON command in a POST
 * body; the answer is JSON. The test side reaches it through `adb forward`.
 */
@RunWith(AndroidJUnit4.class)
public final class Agent {
  private static final int PORT = 8642;
  private static final int BACKLOG = 16;
  private static final String CONTENT_LENGTH = "content-length:";

  private UiDevice device;

  @Test
  public void serve() throws IOException, JSONException {
    // The test side waits for its own events; the agent never waits for a screen to go idle.
    Configurator.getInstance().setWaitForIdleTimeout(0).setWaitForSelectorTimeout(0);
    device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
    // As `uiautomator dump` sees a screen: React Native's testIDs (view ids), its views that are
    // not «important for accessibility», and every window — sheets and other apps' dialogs.
    UiAutomation automation = InstrumentationRegistry.getInstrumentation().getUiAutomation();
    AccessibilityServiceInfo info = automation.getServiceInfo();
    info.flags |=
        AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            | AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
    automation.setServiceInfo(info);
    try (ServerSocket server = new ServerSocket(PORT, BACKLOG, InetAddress.getLoopbackAddress())) {
      boolean serving = true;
      while (serving) {
        try (Socket client = server.accept()) {
          JSONObject command;
          try {
            command = new JSONObject(readBody(client.getInputStream()));
          } catch (JSONException unreadable) {
            write(client, failed("not a JSON command: " + unreadable.getMessage()));
            continue;
          }
          serving = !"stop".equals(command.optString("name"));
          write(client, answerOrFailure(command));
        }
      }
    }
  }

  /**
   * One command's answer; whatever goes wrong in it is that command's failure. An exception left
   * to escape would end `serve`, and with it every later test's agent.
   */
  private JSONObject answerOrFailure(JSONObject command) throws JSONException {
    try {
      return answer(command);
    } catch (RuntimeException broken) {
      return failed(command.optString("name") + " broke: " + broken);
    }
  }

  private JSONObject answer(JSONObject command) throws JSONException {
    String name = command.optString("name");
    switch (name) {
      case "ping":
      case "stop":
        return ok(JSONObject.NULL);
      case "locate":
        try {
          return ok(placeOf(find(command.getString("id"))));
        } catch (StaleObjectException vanished) {
          // Found, then gone before it was measured: a row just deleted, a sheet just closed.
          return ok(JSONObject.NULL);
        }
      case "dump": {
        // The view tree as `uiautomator dump` writes it, for a failed test's evidence: a dump of
        // its own would take UiAutomation from this agent.
        ByteArrayOutputStream tree = new ByteArrayOutputStream();
        try {
          device.dumpWindowHierarchy(tree);
        } catch (IOException unwritten) {
          return failed("the view tree could not be written: " + unwritten.getMessage());
        }
        return ok(new String(tree.toByteArray(), StandardCharsets.UTF_8));
      }
      case "setText": {
        UiObject2 field = find(command.getString("id"));
        if (field == null) {
          return failed("no «" + command.getString("id") + "» on screen");
        }
        field.setText(command.getString("text"));
        return ok(JSONObject.NULL);
      }
      default:
        return failed("unknown command «" + name + "»");
    }
  }

  /** A view by its `testID` (React Native's resource name) or another app's full resource id. */
  private UiObject2 find(String id) {
    return device.findObject(By.res(Pattern.compile(Pattern.quote(id))));
  }

  private Object placeOf(UiObject2 element) throws JSONException {
    if (element == null) {
      return JSONObject.NULL;
    }
    Rect bounds = element.getVisibleBounds();
    return new JSONObject()
        .put("left", bounds.left)
        .put("top", bounds.top)
        .put("right", bounds.right)
        .put("bottom", bounds.bottom)
        .put("whole", bounds.top >= 0 && bounds.bottom < device.getDisplayHeight())
        .put("enabled", element.isEnabled())
        .put("checked", element.isChecked());
  }

  private static JSONObject ok(Object result) throws JSONException {
    return new JSONObject().put("ok", true).put("result", result);
  }

  private static JSONObject failed(String error) throws JSONException {
    return new JSONObject().put("ok", false).put("error", error);
  }

  /** The body of one HTTP request: headers up to the blank line, then Content-Length bytes. */
  private static String readBody(InputStream in) throws IOException {
    ByteArrayOutputStream line = new ByteArrayOutputStream();
    int length = 0;
    for (int next = in.read(); next >= 0; next = in.read()) {
      if (next != '\n') {
        line.write(next);
        continue;
      }
      String header = line.toString(StandardCharsets.UTF_8.name()).trim();
      line.reset();
      if (header.isEmpty()) {
        break;
      }
      if (header.toLowerCase(Locale.ROOT).startsWith(CONTENT_LENGTH)) {
        length = Integer.parseInt(header.substring(CONTENT_LENGTH.length()).trim());
      }
    }
    byte[] body = new byte[length];
    int read = 0;
    while (read < length) {
      int got = in.read(body, read, length - read);
      if (got < 0) {
        break;
      }
      read += got;
    }
    return new String(body, 0, read, StandardCharsets.UTF_8);
  }

  private static void write(Socket client, JSONObject answer) throws IOException {
    byte[] body = answer.toString().getBytes(StandardCharsets.UTF_8);
    OutputStream out = client.getOutputStream();
    out.write(
        ("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                + body.length
                + "\r\nConnection: close\r\n\r\n")
            .getBytes(StandardCharsets.UTF_8));
    out.write(body);
    out.flush();
  }
}
