package com.adityabhalsod.expensetracker.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.adityabhalsod.expensetracker.R

/**
 * ExpenseWidget — Android App Widget that lives on the home screen.
 *
 * Provides two quick-action buttons:
 *   1. "Add Expense"     → opens the app via deep link: expense-tracker://quick-add?type=expense
 *   2. "Got Payment"     → opens the app via deep link: expense-tracker://quick-add?type=income
 *
 * The widget is registered in AndroidManifest.xml as a <receiver> with
 * the APPWIDGET_UPDATE action and references expense_widget_info.xml for its metadata.
 */
class ExpenseWidget : AppWidgetProvider() {

    /**
     * Called by the system when one or more widget instances need to be updated.
     * This is the primary entry point for widget rendering logic.
     */
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Update every widget instance on screen (there may be multiple placed by the user)
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {

        /**
         * Build and push a fresh RemoteViews layout for the given widget instance.
         * Sets up the two action buttons with their respective deep-link PendingIntents.
         */
        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            // Inflate the widget layout into a RemoteViews container
            val views = RemoteViews(context.packageName, R.layout.widget_expense_tracker)

            // ── Add Expense button ──────────────────────────────────────────────────
            // Deep link opens the app (or brings it foreground) and shows the expense quick-add form
            val expenseUri = Uri.parse("expense-tracker://quick-add?type=expense")
            val expenseIntent = Intent(Intent.ACTION_VIEW, expenseUri).apply {
                // Ensure the app's main task is reused instead of creating a duplicate
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            // requestCode 1 differentiates this PendingIntent from the income one
            val expensePendingIntent = PendingIntent.getActivity(
                context,
                1, // unique request code for expense action
                expenseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            // Bind the PendingIntent to the expense button view by its R.id
            views.setOnClickPendingIntent(R.id.btn_add_expense, expensePendingIntent)

            // ── Payment Received button ─────────────────────────────────────────────
            // Deep link opens the app and shows the income/payment-received form
            val incomeUri = Uri.parse("expense-tracker://quick-add?type=income")
            val incomeIntent = Intent(Intent.ACTION_VIEW, incomeUri).apply {
                // Same task-reuse flags as above
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            // requestCode 2 differentiates this PendingIntent from the expense one
            val incomePendingIntent = PendingIntent.getActivity(
                context,
                2, // unique request code for income action
                incomeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            // Bind the PendingIntent to the income button view by its R.id
            views.setOnClickPendingIntent(R.id.btn_payment_received, incomePendingIntent)

            // Push the updated RemoteViews to the widget manager for this instance
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        /**
         * Utility: force-refresh every instance of this widget currently on screen.
         * Can be called from the bridge module after the app saves a new entry,
         * or after the widget content changes.
         */
        fun refreshAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            // Get all active widget instance IDs for this provider class
            val widgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, ExpenseWidget::class.java)
            )
            // Re-render each instance
            for (widgetId in widgetIds) {
                updateAppWidget(context, appWidgetManager, widgetId)
            }
        }
    }
}
