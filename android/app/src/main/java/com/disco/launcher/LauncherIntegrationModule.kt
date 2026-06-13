package com.disco.launcher

import android.content.Intent
import android.content.ActivityNotFoundException
import android.content.pm.PackageManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

data class SupportedLauncher(
  val id: String,
  val name: String,
  val packageNames: List<String>,
)

class LauncherIntegrationModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

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
