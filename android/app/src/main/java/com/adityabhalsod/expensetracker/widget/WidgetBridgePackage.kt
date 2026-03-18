package com.adityabhalsod.expensetracker.widget

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * WidgetBridgePackage — ReactPackage that registers WidgetBridgeModule with the RN runtime.
 *
 * Added manually to MainApplication's package list because it is not an npm package
 * and therefore not picked up by auto-linking.
 *
 * Usage in MainApplication.kt:
 *   PackageList(this).packages.apply {
 *       add(WidgetBridgePackage())
 *   }
 */
class WidgetBridgePackage : ReactPackage {

    /**
     * Return the native modules provided by this package.
     * WidgetBridgeModule is the only module in this package.
     */
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {
        // Register WidgetBridgeModule so JS can access it via NativeModules.WidgetBridge
        return listOf(WidgetBridgeModule(reactContext))
    }

    /**
     * No custom view managers needed for the widget bridge — return an empty list.
     */
    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> = emptyList()
}
