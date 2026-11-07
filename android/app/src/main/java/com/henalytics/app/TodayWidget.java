package com.henalytics.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Henalytics "Today" home-screen widget.
 *
 * Shows tonight's frost warning (only when frost-tender crops are planted),
 * eggs logged today, and the next few calendar items, plus Eggs / Harvest /
 * Note buttons. The app writes the snapshot through WidgetBridgePlugin
 * (SharedPreferences "henalytics_widget" → "today", built by
 * src/widgetBridge.js). A stale snapshot (from an earlier day) drops the
 * eggs/frost lines and only shows tasks dated today or later.
 */
public class TodayWidget extends AppWidgetProvider {

    static final String PREFS = "henalytics_widget";
    static final String KEY = "today";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, build(context));
        }
    }

    /** Refresh every placed Today widget (called by WidgetBridgePlugin). */
    static void refreshAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, TodayWidget.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) mgr.updateAppWidget(id, views);
    }

    private static String localDay(Date d) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(d);
    }

    private static String dayLabel(String iso, String today, String tomorrow) {
        if (iso.equals(today)) return "Today";
        if (iso.equals(tomorrow)) return "Tomorrow";
        try {
            Date d = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(iso);
            return new SimpleDateFormat("EEE", Locale.getDefault()).format(d);
        } catch (Exception e) {
            return iso;
        }
    }

    private static void setRow(RemoteViews v, int id, String text) {
        if (text == null || text.isEmpty()) {
            v.setViewVisibility(id, View.GONE);
        } else {
            v.setTextViewText(id, text);
            v.setViewVisibility(id, View.VISIBLE);
        }
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        Date now = new Date();
        String today = localDay(now);
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DATE, 1);
        String tomorrow = localDay(c.getTime());
        v.setTextViewText(R.id.today_date,
                new SimpleDateFormat("EEE, MMM d", Locale.getDefault()).format(now));

        String title = "Today";
        String frost = null, eggs = null;
        String[] tasks = new String[3];
        int taskCount = 0;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY, null);
        if (raw != null) {
            try {
                JSONObject o = new JSONObject(raw);
                boolean fresh = today.equals(o.optString("day"));
                String name = o.optString("name", "");
                if (!name.isEmpty()) title = name;
                if (fresh && !o.isNull("frost")) {
                    JSONObject f = o.optJSONObject("frost");
                    if (f != null) {
                        StringBuilder sb = new StringBuilder("Frost tonight, low " + f.optString("lowText"));
                        JSONArray crops = f.optJSONArray("crops");
                        if (crops != null && crops.length() > 0) {
                            sb.append(": cover ");
                            for (int i = 0; i < crops.length(); i++) {
                                if (i > 0) sb.append(i == crops.length() - 1 ? " & " : ", ");
                                sb.append(crops.optString(i).toLowerCase(Locale.getDefault()));
                            }
                        }
                        frost = sb.toString();
                    }
                }
                if (!o.isNull("eggsToday")) {
                    int n = fresh ? o.optInt("eggsToday", 0) : 0;
                    eggs = n > 0 ? n + (n == 1 ? " egg" : " eggs") + " today" : "No eggs logged yet today";
                }
                JSONArray arr = o.optJSONArray("tasks");
                if (arr != null) {
                    for (int i = 0; i < arr.length() && taskCount < 3; i++) {
                        JSONObject t = arr.optJSONObject(i);
                        if (t == null) continue;
                        String d = t.optString("date");
                        if (d.compareTo(today) < 0) continue;
                        tasks[taskCount++] = dayLabel(d, today, tomorrow) + " · " + t.optString("title");
                    }
                }
            } catch (Exception ignored) { }
        }
        if (taskCount == 0) tasks[taskCount++] = raw == null ? "Open Henalytics once to fill this in" : "Nothing on the calendar this week";

        v.setTextViewText(R.id.today_title, title);
        setRow(v, R.id.row_frost, frost);
        setRow(v, R.id.row_eggs, eggs);
        setRow(v, R.id.row_task1, tasks[0]);
        setRow(v, R.id.row_task2, tasks[1]);
        // Frost takes a line; keep the widget from overflowing at 4x2.
        setRow(v, R.id.row_task3, frost == null ? tasks[2] : null);

        QuickLogWidget.bind(context, v, R.id.today_header, "henalytics://open", 201);
        QuickLogWidget.bind(context, v, R.id.tbtn_eggs, "henalytics://log?hobby=egg_layers&action=eggs", 202);
        QuickLogWidget.bind(context, v, R.id.tbtn_harvest, "henalytics://log?hobby=garden&action=harvested", 203);
        QuickLogWidget.bind(context, v, R.id.tbtn_note, "henalytics://log?hobby=any&action=note", 204);
        return v;
    }
}
