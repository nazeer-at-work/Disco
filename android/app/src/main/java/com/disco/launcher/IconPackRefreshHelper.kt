package com.disco.launcher

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

object IconPackRefreshHelper {
  fun notifyIconPackChanged(context: Context) {
    val pm = context.packageManager
    val marker = ComponentName(context, IconPackRefreshMarker::class.java)

    try {
      pm.setComponentEnabledSetting(
        marker,
        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
        PackageManager.DONT_KILL_APP,
      )
      pm.setComponentEnabledSetting(
        marker,
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
        PackageManager.DONT_KILL_APP,
      )
    } catch (_: Exception) {
      // Best effort only. Some launchers will still require manual re-apply.
    }
  }
}
