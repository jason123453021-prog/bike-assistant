const fs = require("node:fs");
const path = require("node:path");
const {
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
  withGradleProperties,
  withMainActivity,
  withMainApplication,
} = require("@expo/config-plugins");

const PLUGIN_NAME = "with-bike-ride-pip";
const MAIN_ACTIVITY_MARKER = "// @bike-ride-pip";
const MAIN_APPLICATION_MARKER = "// @bike-ride-pip-package";

function withBikeRidePip(config) {
  config = withAndroidManifest(config, (nextConfig) => {
    const application = nextConfig.modResults.manifest.application?.[0];
    const mainActivity = application?.activity?.find((activity) => activity.$?.["android:name"] === ".MainActivity");
    if (!mainActivity) {
      throw new Error("Unable to locate MainActivity while configuring Android PiP.");
    }

    mainActivity.$["android:supportsPictureInPicture"] = "true";
    mainActivity.$["android:resizeableActivity"] = "true";
    return nextConfig;
  });

  config = withGradleProperties(config, (nextConfig) => {
    const existing = nextConfig.modResults.find((item) => item.key === "EX_DEV_CLIENT_NETWORK_INSPECTOR");
    if (existing) {
      existing.value = "false";
    } else {
      nextConfig.modResults.push({ type: "property", key: "EX_DEV_CLIENT_NETWORK_INSPECTOR", value: "false" });
    }
    return nextConfig;
  });

  config = withMainActivity(config, (nextConfig) => {
    let source = nextConfig.modResults.contents;
    if (source.includes(MAIN_ACTIVITY_MARKER)) {
      source = source.replace(
        "    val builder = PictureInPictureParams.Builder()\n      .setAspectRatio(Rational(16, 9))\n      .setSeamlessResizeEnabled(false)\n    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {\n      builder.setAutoEnterEnabled(autoEnter)",
        "    val builder = PictureInPictureParams.Builder()\n      .setAspectRatio(Rational(16, 9))\n    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {\n      builder.setSeamlessResizeEnabled(false)\n      builder.setAutoEnterEnabled(autoEnter)",
      );
      source = source.replace(
        "if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && ridePipActive && !isInPictureInPictureMode)",
        "if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && Build.VERSION.SDK_INT < Build.VERSION_CODES.S && ridePipActive && !isInPictureInPictureMode)",
      );
      if (!source.includes("private var pipTurnIcon: TextView? = null")) {
        source = source.replace(
          "  private var pipHeader: TextView? = null\n  private var pipInstruction: TextView? = null",
          "  private var pipHeader: TextView? = null\n  private var pipTurnIcon: TextView? = null\n  private var pipInstruction: TextView? = null",
        );
        source = source.replace(
          "    pipInstruction = TextView(this).apply {",
          "    pipTurnIcon = TextView(this).apply {\n      setTextColor(Color.WHITE)\n      textSize = 30f\n      setTypeface(typeface, android.graphics.Typeface.BOLD)\n    }\n    pipInstruction = TextView(this).apply {",
        );
        source = source.replace(
          "    content.addView(pipHeader)\n    content.addView(pipInstruction)",
          "    content.addView(pipHeader)\n    content.addView(pipTurnIcon)\n    content.addView(pipInstruction)",
        );
        source = source.replace(
          "    pipHeader?.text = if (ridePipPaused) \"騎乘已暫停\" else \"騎乘導航\"\n    pipInstruction?.text = ridePipInstruction",
          "    pipHeader?.text = if (ridePipPaused) \"騎乘已暫停\" else \"騎乘導航\"\n    pipTurnIcon?.text = when {\n      ridePipInstruction.contains(\"左轉\") -> \"↰\"\n      ridePipInstruction.contains(\"右轉\") -> \"↱\"\n      ridePipInstruction.contains(\"到達\") -> \"⌖\"\n      else -> \"↑\"\n    }\n    pipInstruction?.text = ridePipInstruction",
        );
      }
      if (!source.includes("private fun applyRidePipTheme()")) {
        source = source.replace(
          "import android.content.IntentFilter",
          "import android.content.IntentFilter\nimport android.content.res.Configuration",
        );
        source = source.replace(
          "    pipOverlay = overlay\n    renderRidePipSnapshot()",
          "    pipOverlay = overlay\n    applyRidePipTheme()\n    renderRidePipSnapshot()",
        );
        source = source.replace(
          "  private fun renderRidePipSnapshot() {",
          `  private fun applyRidePipTheme() {
    val isDarkTheme = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    val backgroundColor = if (isDarkTheme) Color.rgb(0, 83, 66) else Color.rgb(235, 247, 241)
    val primaryTextColor = if (isDarkTheme) Color.WHITE else Color.rgb(4, 61, 45)
    val secondaryTextColor = if (isDarkTheme) Color.rgb(210, 244, 234) else Color.rgb(31, 94, 74)
    pipOverlay?.setBackgroundColor(backgroundColor)
    pipHeader?.setTextColor(primaryTextColor)
    pipTurnIcon?.setTextColor(primaryTextColor)
    pipInstruction?.setTextColor(primaryTextColor)
    pipMetrics?.setTextColor(secondaryTextColor)
  }

  private fun renderRidePipSnapshot() {`,
        );
        source = source.replace(
          "  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean) {",
          "  override fun onConfigurationChanged(newConfig: Configuration) {\n    super.onConfigurationChanged(newConfig)\n    applyRidePipTheme()\n  }\n\n  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean) {",
        );
      }
      nextConfig.modResults.contents = source;
      return nextConfig;
    }

    source = source.replace(
      "import android.os.Build",
      `import android.app.PictureInPictureParams
import android.content.BroadcastReceiver
import android.content.Context
	import android.content.Intent
	import android.content.IntentFilter
	import android.content.res.Configuration
	import android.graphics.Color
import android.os.Build
import android.util.Rational
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView`,
    );

    source = source.replace(
      "class MainActivity : ReactActivity() {",
      `class MainActivity : ReactActivity() {
  ${MAIN_ACTIVITY_MARKER}
  private var ridePipActive = false
  private var ridePipPaused = false
  private var ridePipInstruction = "騎乘中"
  private var ridePipTurnDistanceM = 0.0
  private var ridePipSpeedKmh = 0.0
  private var ridePipDistanceKm = 0.0
  private var pipOverlay: FrameLayout? = null
  private var pipHeader: TextView? = null
  private var pipTurnIcon: TextView? = null
  private var pipInstruction: TextView? = null
  private var pipMetrics: TextView? = null

  private val ridePipReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action != BikeRidePipContract.ACTION) return
      if (intent.getBooleanExtra(BikeRidePipContract.EXTRA_CLOSE, false)) {
        ridePipActive = false
        setRidePipParams(false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode) {
          finishAndRemoveTask()
        }
        return
      }

      ridePipActive = intent.getBooleanExtra(BikeRidePipContract.EXTRA_ACTIVE, false)
      ridePipPaused = intent.getBooleanExtra(BikeRidePipContract.EXTRA_PAUSED, false)
      ridePipInstruction = intent.getStringExtra(BikeRidePipContract.EXTRA_INSTRUCTION)?.ifBlank { "騎乘中" } ?: "騎乘中"
      ridePipTurnDistanceM = intent.getDoubleExtra(BikeRidePipContract.EXTRA_TURN_DISTANCE_M, 0.0)
      ridePipSpeedKmh = intent.getDoubleExtra(BikeRidePipContract.EXTRA_SPEED_KMH, 0.0)
      ridePipDistanceKm = intent.getDoubleExtra(BikeRidePipContract.EXTRA_DISTANCE_KM, 0.0)
      renderRidePipSnapshot()
      setRidePipParams(ridePipActive)

      if (!ridePipActive && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode) {
        finishAndRemoveTask()
      }
    }
  }

  private fun setRidePipParams(autoEnter: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val builder = PictureInPictureParams.Builder()
      .setAspectRatio(Rational(16, 9))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setSeamlessResizeEnabled(false)
      builder.setAutoEnterEnabled(autoEnter)
    }
    setPictureInPictureParams(builder.build())
  }

  private fun initializeRidePipOverlay() {
    val overlay = FrameLayout(this).apply {
      visibility = View.GONE
      setBackgroundColor(Color.rgb(0, 83, 66))
      isClickable = false
      isFocusable = false
    }
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(18, 12, 18, 12)
    }
    pipHeader = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 12f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    pipInstruction = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 22f
      maxLines = 1
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    pipTurnIcon = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 30f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    pipMetrics = TextView(this).apply {
      setTextColor(Color.rgb(210, 244, 234))
      textSize = 14f
    }
    content.addView(pipHeader)
    content.addView(pipTurnIcon)
    content.addView(pipInstruction)
    content.addView(pipMetrics)
    overlay.addView(content, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    addContentView(overlay, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
	    pipOverlay = overlay
	    applyRidePipTheme()
	    renderRidePipSnapshot()
	  }

	  private fun applyRidePipTheme() {
	    val isDarkTheme = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
	    val backgroundColor = if (isDarkTheme) Color.rgb(0, 83, 66) else Color.rgb(235, 247, 241)
	    val primaryTextColor = if (isDarkTheme) Color.WHITE else Color.rgb(4, 61, 45)
	    val secondaryTextColor = if (isDarkTheme) Color.rgb(210, 244, 234) else Color.rgb(31, 94, 74)
	    pipOverlay?.setBackgroundColor(backgroundColor)
	    pipHeader?.setTextColor(primaryTextColor)
	    pipTurnIcon?.setTextColor(primaryTextColor)
	    pipInstruction?.setTextColor(primaryTextColor)
	    pipMetrics?.setTextColor(secondaryTextColor)
	  }

	  private fun renderRidePipSnapshot() {
	    applyRidePipTheme()
	    pipHeader?.text = if (ridePipPaused) "騎乘已暫停" else "騎乘導航"
    pipTurnIcon?.text = when {
      ridePipInstruction.contains("左轉") -> "↰"
      ridePipInstruction.contains("右轉") -> "↱"
      ridePipInstruction.contains("到達") -> "⌖"
      else -> "↑"
    }
    pipInstruction?.text = ridePipInstruction
    val turnDistance = if (ridePipTurnDistanceM > 0.0) "・\${ridePipTurnDistanceM.toInt()} m" else ""
    pipMetrics?.text = String.format("%.1f km/h ・ %.2f km%s", ridePipSpeedKmh, ridePipDistanceKm, turnDistance)
  }
`,
    );

    source = source.replace(
      "    super.onCreate(null)",
      `    super.onCreate(null)
    initializeRidePipOverlay()
    val filter = IntentFilter(BikeRidePipContract.ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(ridePipReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      registerReceiver(ridePipReceiver, filter)
    }`,
    );

    source = source.replace(
      "  /**\n   * Returns the name of the main component",
      `  override fun onUserLeaveHint() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && Build.VERSION.SDK_INT < Build.VERSION_CODES.S && ridePipActive && !isInPictureInPictureMode) {
      enterPictureInPictureMode()
    }
    super.onUserLeaveHint()
  }

	  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean) {
	    super.onPictureInPictureModeChanged(isInPictureInPictureMode)
	    pipOverlay?.visibility = if (isInPictureInPictureMode) View.VISIBLE else View.GONE
	  }

	  override fun onConfigurationChanged(newConfig: Configuration) {
	    super.onConfigurationChanged(newConfig)
	    applyRidePipTheme()
	  }

  override fun onDestroy() {
    try {
      unregisterReceiver(ridePipReceiver)
    } catch (_: IllegalArgumentException) {
      // Receiver was not registered because Activity creation was interrupted.
    }
    super.onDestroy()
  }

  /**
   * Returns the name of the main component`,
    );

    nextConfig.modResults.contents = source;
    return nextConfig;
  });

  config = withMainApplication(config, (nextConfig) => {
    const source = nextConfig.modResults.contents;
    if (source.includes(MAIN_APPLICATION_MARKER)) return nextConfig;
    nextConfig.modResults.contents = source.replace(
      "// add(MyReactNativePackage())",
      `${MAIN_APPLICATION_MARKER}\n              add(BikeRidePipPackage())`,
    );
    return nextConfig;
  });

  config = withDangerousMod(config, ["android", async (nextConfig) => {
    const packageName = nextConfig.android?.package;
    if (!packageName) throw new Error("Android package is required for Bike PiP integration.");
    const javaDir = path.join(nextConfig.modRequest.platformProjectRoot, "app", "src", "main", "java", ...packageName.split("."));
    fs.mkdirSync(javaDir, { recursive: true });
    fs.writeFileSync(path.join(javaDir, "BikeRidePipModule.kt"), buildModuleSource(packageName));
    fs.writeFileSync(path.join(javaDir, "BikeRidePipPackage.kt"), buildPackageSource(packageName));
    return nextConfig;
  }]);

  return config;
}

function buildModuleSource(packageName) {
  return `package ${packageName}

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

object BikeRidePipContract {
  const val ACTION = "${packageName}.RIDE_PIP_SNAPSHOT"
  const val EXTRA_ACTIVE = "active"
  const val EXTRA_PAUSED = "paused"
  const val EXTRA_INSTRUCTION = "instruction"
  const val EXTRA_TURN_DISTANCE_M = "turnDistanceM"
  const val EXTRA_SPEED_KMH = "speedKmh"
  const val EXTRA_DISTANCE_KM = "distanceKm"
  const val EXTRA_CLOSE = "close"
}

class BikeRidePipModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "BikeRidePip"

  @ReactMethod
  fun isSupported(promise: Promise) {
    val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      reactContext.packageManager.hasSystemFeature("android.software.picture_in_picture")
    promise.resolve(supported)
  }

  @ReactMethod
  fun setRideSnapshot(snapshot: ReadableMap) {
    val intent = Intent(BikeRidePipContract.ACTION).setPackage(reactContext.packageName)
    intent.putExtra(BikeRidePipContract.EXTRA_ACTIVE, snapshot.getBoolean("active"))
    intent.putExtra(BikeRidePipContract.EXTRA_PAUSED, snapshot.getBoolean("paused"))
    intent.putExtra(BikeRidePipContract.EXTRA_INSTRUCTION, snapshot.getString("instruction"))
    intent.putExtra(BikeRidePipContract.EXTRA_TURN_DISTANCE_M, snapshot.getDouble("turnDistanceM"))
    intent.putExtra(BikeRidePipContract.EXTRA_SPEED_KMH, snapshot.getDouble("speedKmh"))
    intent.putExtra(BikeRidePipContract.EXTRA_DISTANCE_KM, snapshot.getDouble("distanceKm"))
    reactContext.sendBroadcast(intent)
  }

  @ReactMethod
  fun close() {
    reactContext.sendBroadcast(
      Intent(BikeRidePipContract.ACTION)
        .setPackage(reactContext.packageName)
        .putExtra(BikeRidePipContract.EXTRA_CLOSE, true),
    )
  }
}
`;
}

function buildPackageSource(packageName) {
  return `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BikeRidePipPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(BikeRidePipModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`;
}

module.exports = createRunOncePlugin(withBikeRidePip, PLUGIN_NAME, "1.0.0");
