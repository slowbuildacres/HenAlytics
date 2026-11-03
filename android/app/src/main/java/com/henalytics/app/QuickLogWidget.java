package com.henalytics.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Henalytics "Quick Log" home-screen widget.
 *
 * Four buttons (Eggs, Harvest, Water, Note). Each opens the app straight into a log form through a
 * henalytics:// link that HomesteadApp.jsx handles (see WIDGET DEEP LINKS).
 * Nothing is stored or synced by the widget itself.
 */
public class QuickLogWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_log);
            bind(context, views, R.id.btn_eggs,  "henalytics://log?hobby=egg_layers&action=eggs", 101);
            bind(context, views, R.id.btn_harvest, "henalytics://log?hobby=garden&action=harvested", 102);
            bind(context, views, R.id.btn_water, "henalytics://log?hobby=garden&action=watered", 103);
            // hobby=any → whichever hobby you were last on
            bind(context, views, R.id.btn_note,  "henalytics://log?hobby=any&action=note", 104);
            manager.updateAppWidget(id, views);
        }
    }

    static void bind(Context ctx, RemoteViews views, int viewId, String uri, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
        intent.setPackage(ctx.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        // Unique requestCode per button, or Android reuses one PendingIntent for all four.
        PendingIntent pi = PendingIntent.getActivity(
                ctx, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(viewId, pi);
    }
}
