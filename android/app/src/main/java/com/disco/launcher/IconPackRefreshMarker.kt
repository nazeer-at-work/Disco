package com.disco.launcher

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class IconPackRefreshMarker : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    // This receiver exists only so the app can toggle one of its own components
    // and trigger a package-changed signal that some launchers use to refresh icon packs.
  }
}
