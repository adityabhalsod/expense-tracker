package com.adityabhalsod.expensetracker.widget

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

/**
 * WidgetBridgeModule — React Native native module that bridges the widget and JavaScript.
 *
 * Responsibilities:
 *   1. Store a pending quick-add entry to SharedPreferences when the widget is used
 *      while the JS side hasn't processed it yet (e.g., app restarts after offline entry).
 *   2. Let JS query whether a pending entry exists and retrieve its data.
 *   3. Clear the pending entry once JS has saved it to the database.
 *   4. Expose whether the current app launch originated from a widget tap.
 *
 * Registered via WidgetBridgePackage and added to MainApplication's package list.
 * Accessed in JS via NativeModules.WidgetBridge.
 */
class WidgetBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    // SharedPreferences file name — isolated to avoid collisions with other prefs
    private val PREFS_NAME = "ExpenseTrackerWidgetPrefs"

    // Keys for individual stored values
    private val KEY_PENDING_TYPE   = "pending_type"    // "expense" or "income"
    private val KEY_PENDING_AMOUNT = "pending_amount"  // amount pre-filled (optional)
    private val KEY_FROM_WIDGET    = "launched_from_widget" // flag set when deep link triggers

    // Lazily-accessed SharedPreferences instance
    private val prefs: SharedPreferences
        get() = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** Module name as referenced by NativeModules.WidgetBridge in JS */
    override fun getName(): String = "WidgetBridge"

    /**
     * Save a pending widget entry to SharedPreferences.
     * Called if JS wants to pre-cache a partially-filled entry from the widget side.
     * @param type    "expense" or "income"
     * @param amount  Amount string (can be empty)
     */
    @ReactMethod
    fun savePendingEntry(type: String, amount: String) {
        // Write both fields atomically via commit()
        prefs.edit()
            .putString(KEY_PENDING_TYPE, type)
            .putString(KEY_PENDING_AMOUNT, amount)
            .putBoolean(KEY_FROM_WIDGET, true)
            .apply() // async write — safe for non-critical data
    }

    /**
     * Read any pending widget entry from SharedPreferences.
     * Returns a map with keys: type, amount, fromWidget — or resolves null if none exists.
     * Called from JS on app startup to check if a widget triggered this session.
     */
    @ReactMethod
    fun getPendingEntry(promise: Promise) {
        try {
            val type   = prefs.getString(KEY_PENDING_TYPE, null)
            val amount = prefs.getString(KEY_PENDING_AMOUNT, "") ?: ""
            val fromWidget = prefs.getBoolean(KEY_FROM_WIDGET, false)

            if (type != null || fromWidget) {
                // Build a JS-readable map with the pending entry details
                val map: WritableMap = Arguments.createMap()
                map.putString("type", type ?: "expense") // default to expense if type missing
                map.putString("amount", amount)
                map.putBoolean("fromWidget", fromWidget)
                promise.resolve(map) // Deliver the map to JS
            } else {
                // No pending entry — resolve with null so JS skips the widget flow
                promise.resolve(null)
            }
        } catch (e: Exception) {
            // Promise rejection with descriptive message for JS error handling
            promise.reject("WIDGET_BRIDGE_ERROR", e.message, e)
        }
    }

    /**
     * Clear the stored pending entry after JS has successfully saved it to the database.
     * Must be called after every successful save to avoid showing the form on the next launch.
     */
    @ReactMethod
    fun clearPendingEntry() {
        // Remove all widget-related keys from SharedPreferences
        prefs.edit()
            .remove(KEY_PENDING_TYPE)
            .remove(KEY_PENDING_AMOUNT)
            .remove(KEY_FROM_WIDGET)
            .apply() // async write is fine here
    }

    /**
     * Mark that the app was launched from a widget deep link.
     * Called from MainActivity when it detects a widget-origin intent.
     * This is separate from savePendingEntry — it only marks origin without storing a form payload.
     */
    @ReactMethod
    fun markLaunchedFromWidget() {
        prefs.edit()
            .putBoolean(KEY_FROM_WIDGET, true)
            .apply()
    }

    /**
     * Refresh all active widget instances on the home screen.
     * Can be called from JS after saving a new entry so the widget reflects the update.
     */
    @ReactMethod
    fun refreshWidgets() {
        // Delegate to the static utility on ExpenseWidget
        ExpenseWidget.refreshAllWidgets(reactApplicationContext)
    }
}
