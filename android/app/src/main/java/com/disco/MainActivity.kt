package com.disco

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.disco.launcher.IconPackRefreshHelper

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "IconPack"

  /**
   * Nudge launchers to re-read our icon pack every time the app is opened/resumed. After the
   * pack is updated (new icons/mappings), this lets the user just open the app to refresh,
   * instead of switching to another pack and back. Best-effort: honored by launchers that watch
   * for icon-pack package changes.
   */
  override fun onResume() {
    super.onResume()
    IconPackRefreshHelper.notifyIconPackChanged(this)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
