package com.disco.launcher

import android.content.Intent
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

data class SupportedLauncher(
  val id: String,
  val name: String,
  val packageNames: List<String>,
)

private data class LaunchableAppEntry(
  val label: String,
  val iconUri: String?,
  val activityName: String?,
)

class LauncherIntegrationModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private val feedbackPrefs by lazy {
    reactContext.getSharedPreferences("disco_feedback", Context.MODE_PRIVATE)
  }

  private val launchers = listOf(
    SupportedLauncher(
      "nova",
      "Nova Launcher",
      listOf("com.teslacoilsw.launcher", "com.teslacoilsw.launcher.beta"),
    ),
    SupportedLauncher("lawnchair", "Lawnchair", listOf("app.lawnchair")),
    SupportedLauncher("apex", "Apex Launcher", listOf("com.anddoes.launcher")),
    SupportedLauncher("action", "Action Launcher", listOf("com.actionlauncher.playstore")),
    SupportedLauncher("smart", "Smart Launcher", listOf("ginlemon.flowerfree")),
    SupportedLauncher("adw", "ADW Launcher 2", listOf("org.adwfreak.launcher")),
    SupportedLauncher("poco", "POCO Launcher", listOf("com.mi.android.globallauncher")),
    SupportedLauncher("nothing", "Nothing Launcher", listOf("com.nothing.launcher")),
  )

  override fun getName(): String = "LauncherIntegration"

  /**
   * Best-effort nudge for launchers to re-read this icon pack (after the pack is
   * updated with new icons/mappings) without the user switching packs. Mirrors the
   * automatic nudge done on app resume.
   */
  @ReactMethod
  fun refreshIconPack(promise: Promise) {
    try {
      IconPackRefreshHelper.notifyIconPackChanged(reactContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("ICON_PACK_REFRESH_ERROR", error)
    }
  }

  @ReactMethod
  fun getSupportedLaunchers(promise: Promise) {
    try {
      val result = Arguments.createArray()

      launchers.forEach { launcher ->
        val installedPackage = launcher.packageNames.firstOrNull { isPackageInstalled(it) }
        val row = Arguments.createMap()
        row.putString("id", launcher.id)
        row.putString("name", launcher.name)
        row.putString("packageName", installedPackage ?: launcher.packageNames.first())
        row.putBoolean("installed", installedPackage != null)
        result.pushMap(row)
      }

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("LAUNCHER_LIST_ERROR", error)
    }
  }

  @ReactMethod
  fun getLaunchableApps(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      val byPackage = linkedMapOf<String, LaunchableAppEntry>()

      // Path 1: launcher activities (fast, accurate for visible launcher apps).
      val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolveFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        PackageManager.ResolveInfoFlags.of(0)
      } else {
        null
      }
      @Suppress("DEPRECATION")
      val activities = if (resolveFlags != null) {
        pm.queryIntentActivities(launcherIntent, resolveFlags)
      } else {
        pm.queryIntentActivities(launcherIntent, 0)
      }
      activities.forEach { resolveInfo ->
        val activityInfo = resolveInfo.activityInfo ?: return@forEach
        val packageName = activityInfo.packageName ?: return@forEach
        if (packageName == reactContext.packageName) return@forEach
        if (!byPackage.containsKey(packageName)) {
          val label = resolveInfo.loadLabel(pm)?.toString()?.trim().orEmpty()
          val iconDataUri = drawableToFileUri(packageName, resolveInfo.loadIcon(pm))
          byPackage[packageName] = LaunchableAppEntry(
            label = if (label.isNotEmpty()) label else packageName,
            iconUri = iconDataUri,
            activityName = activityInfo.name,
          )
        }
      }

      // Path 2: installed apps that have a launch intent (fallback coverage).
      val appFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        PackageManager.ApplicationInfoFlags.of(0)
      } else {
        null
      }
      @Suppress("DEPRECATION")
      val installedApps = if (appFlags != null) {
        pm.getInstalledApplications(appFlags)
      } else {
        pm.getInstalledApplications(0)
      }
      installedApps.forEach { appInfo ->
        val packageName = appInfo.packageName ?: return@forEach
        if (packageName == reactContext.packageName) return@forEach
        if ((appInfo.flags and ApplicationInfo.FLAG_INSTALLED) == 0) return@forEach
        if ((appInfo.flags and ApplicationInfo.FLAG_SUSPENDED) != 0) return@forEach
        val launchIntent = pm.getLaunchIntentForPackage(packageName) ?: return@forEach
        val resolved = launchIntent.resolveActivity(pm) ?: return@forEach
        if (resolved.packageName != packageName) return@forEach
        if (!byPackage.containsKey(packageName)) {
          val label = pm.getApplicationLabel(appInfo)?.toString()?.trim().orEmpty()
          val iconDataUri = drawableToFileUri(packageName, pm.getApplicationIcon(appInfo))
          byPackage[packageName] = LaunchableAppEntry(
            label = if (label.isNotEmpty()) label else packageName,
            iconUri = iconDataUri,
            activityName = resolved.className,
          )
        }
      }

      val rows = byPackage.entries
        .sortedWith(compareBy({ it.value.label.lowercase() }, { it.key.lowercase() }))
      val result = Arguments.createArray()
      rows.forEach { entry ->
        val row = Arguments.createMap()
        row.putString("packageName", entry.key)
        row.putString("label", entry.value.label)
        row.putString("iconUri", entry.value.iconUri)
        row.putString("activityName", entry.value.activityName)
        result.pushMap(row)
      }

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("LAUNCHABLE_APPS_ERROR", error)
    }
  }

  @ReactMethod
  fun getCurrentHomeLauncher(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
      val resolveInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.resolveActivity(
          homeIntent,
          PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()),
        )
      } else {
        @Suppress("DEPRECATION")
        pm.resolveActivity(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
      }

      val activityInfo = resolveInfo?.activityInfo
      if (activityInfo == null) {
        promise.resolve(null)
        return
      }

      val row = Arguments.createMap()
      row.putString("packageName", activityInfo.packageName)
      row.putString("activityName", activityInfo.name)
      row.putString("label", resolveInfo.loadLabel(pm)?.toString()?.trim().orEmpty())
      promise.resolve(row)
    } catch (error: Exception) {
      promise.reject("CURRENT_HOME_LAUNCHER_ERROR", error)
    }
  }

  @ReactMethod
  fun getSubmittedFeedbackPackages(mode: String, promise: Promise) {
    try {
      val key = "submitted_${mode.lowercase()}"
      val stored = feedbackPrefs.getStringSet(key, emptySet()) ?: emptySet()
      val result = Arguments.createArray()
      stored.sorted().forEach { pkg ->
        result.pushString(pkg)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("FEEDBACK_SUBMITTED_READ_ERROR", error)
    }
  }

  @ReactMethod
  fun addSubmittedFeedbackPackages(mode: String, packages: ReadableArray, promise: Promise) {
    try {
      val key = "submitted_${mode.lowercase()}"
      val merged = (feedbackPrefs.getStringSet(key, emptySet()) ?: emptySet()).toMutableSet()
      for (index in 0 until packages.size()) {
        val pkg = packages.getString(index)?.trim().orEmpty()
        if (pkg.isNotEmpty()) {
          merged.add(pkg)
        }
      }
      feedbackPrefs.edit().putStringSet(key, merged).apply()

      val result = Arguments.createArray()
      merged.sorted().forEach { pkg ->
        result.pushString(pkg)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("FEEDBACK_SUBMITTED_WRITE_ERROR", error)
    }
  }

  @ReactMethod
  fun getFeedbackDeviceId(promise: Promise) {
    try {
      val key = "feedback_device_id"
      val existing = feedbackPrefs.getString(key, null)?.trim()
      if (!existing.isNullOrEmpty()) {
        promise.resolve(existing)
        return
      }

      val created = UUID.randomUUID().toString()
      feedbackPrefs.edit().putString(key, created).apply()
      promise.resolve(created)
    } catch (error: Exception) {
      promise.reject("FEEDBACK_DEVICE_ID_ERROR", error)
    }
  }

  private fun drawableToFileUri(packageName: String, drawable: Drawable?): String? {
    if (drawable == null) return null

    return try {
      val size = 128
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      drawable.setBounds(0, 0, size, size)
      drawable.draw(canvas)

      val dir = File(reactContext.cacheDir, "launchable-app-icons")
      if (!dir.exists()) {
        dir.mkdirs()
      }
      val safeName = packageName.replace(Regex("[^A-Za-z0-9._-]"), "_")
      val file = File(dir, "$safeName.png")
      FileOutputStream(file).use { out ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        out.flush()
      }
      "file://${file.absolutePath}"
    } catch (_: Exception) {
      null
    }
  }

  @ReactMethod
  fun openLauncherSettings(launcherId: String, promise: Promise) {
    try {
      val launcher = launchers.firstOrNull { it.id == launcherId }
      if (launcher == null) {
        promise.resolve(false)
        return
      }

      val installedPackage = launcher.packageNames.firstOrNull { isPackageInstalled(it) }
      if (installedPackage == null) {
        promise.resolve(false)
        return
      }

      val intents = getCandidateIntents(launcher, installedPackage)
      val opened = intents.any { openIntent(it, installedPackage) }

      if (opened) {
        promise.resolve(true)
        return
      }

      val settingsLauncherIntent = findSettingsLauncherIntent(installedPackage)
      if (settingsLauncherIntent != null && openIntent(settingsLauncherIntent, installedPackage)) {
        promise.resolve(true)
        return
      }

      if (launcher.id == "nova") {
        promise.resolve(false)
        return
      }

      val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(installedPackage)
      promise.resolve(launchIntent?.let { openIntent(it, installedPackage) } == true)
    } catch (error: Exception) {
      promise.reject("LAUNCHER_OPEN_ERROR", error)
    }
  }

  private fun isPackageInstalled(packageName: String): Boolean {
    return try {
      reactContext.packageManager.getPackageInfo(packageName, 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }
  }

  private fun openIntent(intent: Intent, expectedPackageName: String): Boolean {
    val safeIntent = intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val pm = reactContext.packageManager
    val resolved = safeIntent.resolveActivity(pm) ?: return false

    if (resolved.packageName != expectedPackageName) {
      return false
    }

    return try {
      reactContext.startActivity(safeIntent)
      true
    } catch (_: ActivityNotFoundException) {
      false
    } catch (_: SecurityException) {
      false
    }
  }

  private fun getCandidateIntents(
    launcher: SupportedLauncher,
    installedPackage: String,
  ): List<Intent> {
    return when (launcher.id) {
      "nova" -> listOf(
        Intent("com.teslacoilsw.launcher.APPLY_ICON_THEME")
          .setPackage(installedPackage)
          .putExtra("com.teslacoilsw.launcher.extra.ICON_THEME_PACKAGE", reactContext.packageName)
          .putExtra("com.teslacoilsw.launcher.extra.ICON_THEME_TYPE", "GO")
          .putExtra("com.teslacoilsw.launcher.extra.NAME", getAppLabel()),
        Intent().setClassName(installedPackage, "$installedPackage.preferences.SettingsActivity"),
        Intent().setClassName(installedPackage, "com.teslacoilsw.launcher.preferences.SettingsActivity"),
        Intent().setClassName(installedPackage, "com.teslacoilsw.launcher.beta.preferences.SettingsActivity"),
      )
      "lawnchair" -> listOf(
        Intent().setClassName(installedPackage, "app.lawnchair.settings.SettingsActivity"),
      )
      "hyperion" -> listOf(
        Intent().setClassName(installedPackage, "projekt.launcher.settings.SettingsActivity"),
      )
      "apex" -> listOf(
        Intent().setClassName(installedPackage, "com.anddoes.launcher.preference.Preferences"),
      )
      "action" -> listOf(
        Intent().setClassName(installedPackage, "com.actionlauncher.playstore.Settings"),
        Intent().setClassName(installedPackage, "com.actionlauncher.playstore.settings.SettingsActivity"),
      )
      "smart" -> listOf(
        Intent().setClassName(installedPackage, "ginlemon.flowerfree.activities.SplashActivity"),
      )
      "adw" -> listOf(
        Intent().setClassName(installedPackage, "org.adw.launcher2.LauncherPreferences"),
      )
      "poco" -> listOf(
        Intent().setClassName(installedPackage, "com.mi.android.globallauncher.settings.SettingsActivity"),
      )
      "niagara" -> listOf(
        Intent().setClassName(installedPackage, "bitpit.launcher.ui.settings.SettingsActivity"),
      )
      "total" -> listOf(
        Intent().setClassName(installedPackage, "com.ss.launcher2.Launcher"),
      )
      "lynx" -> listOf(
        Intent().setClassName(installedPackage, "org.n277.lynxlauncher.activities.SettingsActivity"),
      )
      "miui" -> listOf(
        Intent().setClassName(installedPackage, "com.miui.home.launcher.settings.MiuiHomeSettings"),
      )
      "nothing" -> listOf(
        Intent().setClassName(installedPackage, "com.nothing.launcher.settings.LauncherSettingsActivity"),
      )
      "moto" -> listOf(
        Intent().setClassName(installedPackage, "com.motorola.launcher3.settings.SettingsActivity"),
        Intent().setClassName(installedPackage, "com.android.launcher3.SettingsActivity"),
      )
      "samsung" -> listOf(
        Intent().setClassName(installedPackage, "com.sec.android.app.launcher.settings.HomeScreenSettingsActivity"),
      )
      "pixel" -> listOf(
        Intent().setClassName(installedPackage, "com.google.android.apps.nexuslauncher.settings.MySettingsActivity"),
      )
      "oneplus" -> listOf(
        Intent().setClassName(installedPackage, "net.oneplus.launcher.SettingsActivity"),
        Intent().setClassName(installedPackage, "com.oneplus.launcher.settings.OPLauncherSettingsActivity"),
      )
      else -> emptyList()
    }
  }

  private fun getAppLabel(): String {
    val pm = reactContext.packageManager
    val appInfo = reactContext.applicationInfo
    return pm.getApplicationLabel(appInfo)?.toString() ?: "Disco"
  }

  private fun findSettingsLauncherIntent(packageName: String): Intent? {
    val pm = reactContext.packageManager
    val launcherQueryIntent = Intent(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_LAUNCHER)
      .setPackage(packageName)

    val settingsActivity = pm.queryIntentActivities(launcherQueryIntent, 0)
      .firstOrNull { resolveInfo ->
        val className = resolveInfo.activityInfo?.name?.lowercase() ?: return@firstOrNull false
        className.contains("setting") || className.contains("prefer")
      }
      ?.activityInfo
      ?.name
      ?: return null

    return Intent().setClassName(packageName, settingsActivity)
  }
}
