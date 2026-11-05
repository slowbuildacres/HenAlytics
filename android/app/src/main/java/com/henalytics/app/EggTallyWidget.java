package com.henalytics.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * "Egg Counter" home-screen widget: − / + / +6 buttons that tally eggs for
 * one flock (picked in EggTallyConfigActivity, changeable by long-press →
 * reconfigure). Taps never open the app: they add to a per-flock, per-day
 * tally in SharedPreferences "henalytics_widget" → "eggTally"
 * ({ flockId: { "yyyy-MM-dd": n } }). The app takes it on open/resume
 * (WidgetBridgePlugin.takeTally) and folds it into that flock's egg basket,
 * so it saves to the day just like the in-app counter (src/widgetBridge.js).
 *
 * Flock names and today's in-app basket come from the app's snapshot
 * ("today", written by WidgetBridgePlugin.setToday).
 */
public class EggTallyWidget extends AppWidgetProvider {

    static final String TALLY_KEY = "eggTally";
    static final String FLOCK_PREFIX = "eggTallyFlock_";
    static final String ACTION_TALLY = "com.henalytics.app.EGG_TALLY";
    static final String EXTRA_DELTA = "delta";

    /** A flock from the snapshot. */
    static final class Flock {
        final String id, name, emoji;
        final int basket, logged;
        Flock(String id, String name, String emoji, int basket, int logged) {
            this.id = id; this.name = name; this.emoji = emoji; this.basket = basket; this.logged = logged;
        }
    }

    static String localDay(Date d) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(d);
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(TodayWidget.PREFS, Context.MODE_PRIVATE);
    }

    /** Flocks from today's snapshot; basket/logged are 0 when the snapshot is from another day. */
    static List<Flock> flocks(Context ctx) {
        List<Flock> out = new ArrayList<>();
        String raw = prefs(ctx).getString(TodayWidget.KEY, null);
        if (raw == null) return out;
        try {
            JSONObject o = new JSONObject(raw);
            boolean fresh = localDay(new Date()).equals(o.optString("day"));
            JSONArray arr = o.optJSONArray("flocks");
            if (arr == null) return out;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject f = arr.optJSONObject(i);
                if (f == null || f.optString("id").isEmpty()) continue;
                out.add(new Flock(f.optString("id"), f.optString("name", "Flock"), f.optString("emoji", "🐔"),
                        fresh ? f.optInt("basket", 0) : 0, fresh ? f.optInt("logged", 0) : 0));
            }
        } catch (Exception ignored) { }
        return out;
    }

    static Flock flockFor(Context ctx, int widgetId) {
        List<Flock> all = flocks(ctx);
        if (all.isEmpty()) return null;
        String want = prefs(ctx).getString(FLOCK_PREFIX + widgetId, null);
        if (want != null) {
            for (Flock f : all) if (f.id.equals(want)) return f;
        }
        return all.get(0);
    }

    static void setFlock(Context ctx, int widgetId, String flockId) {
        prefs(ctx).edit().putString(FLOCK_PREFIX + widgetId, flockId).apply();
    }

    private static JSONObject loadTally(Context ctx) {
        try {
            String raw = prefs(ctx).getString(TALLY_KEY, null);
            return raw == null ? new JSONObject() : new JSONObject(raw);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static int pending(Context ctx, String flockId, String day) {
        JSONObject days = loadTally(ctx).optJSONObject(flockId);
        return days == null ? 0 : days.optInt(day, 0);
    }

    /** Add delta for today; the shown count (basket + pending) never goes below 0. */
    static synchronized void add(Context ctx, Flock flock, int delta) {
        String day = localDay(new Date());
        try {
            JSONObject all = loadTally(ctx);
            JSONObject days = all.optJSONObject(flock.id);
            if (days == null) days = new JSONObject();
            int next = Math.max(-flock.basket, days.optInt(day, 0) + delta);
            if (next == 0) days.remove(day); else days.put(day, next);
            if (days.length() == 0) all.remove(flock.id); else all.put(flock.id, days);
            SharedPreferences.Editor ed = prefs(ctx).edit();
            if (all.length() == 0) ed.remove(TALLY_KEY); else ed.putString(TALLY_KEY, all.toString());
            ed.commit();
        } catch (Exception ignored) { }
    }

    /** Read and clear the tally (WidgetBridgePlugin.takeTally). */
    static synchronized String take(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String raw = p.getString(TALLY_KEY, "");
        if (raw != null && !raw.isEmpty()) p.edit().remove(TALLY_KEY).commit();
        return raw == null ? "" : raw;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) manager.updateAppWidget(id, build(context, id));
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        SharedPreferences.Editor ed = prefs(context).edit();
        for (int id : appWidgetIds) ed.remove(FLOCK_PREFIX + id);
        ed.apply();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && ACTION_TALLY.equals(intent.getAction())) {
            int widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            int delta = intent.getIntExtra(EXTRA_DELTA, 0);
            Flock flock = widgetId == AppWidgetManager.INVALID_APPWIDGET_ID ? null : flockFor(context, widgetId);
            if (flock != null && delta != 0) add(context, flock, delta);
            refreshAll(context);
            return;
        }
        super.onReceive(context, intent);
    }

    /** Redraw every placed Egg Counter (after a tap, or when the app sends a new snapshot). */
    static void refreshAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, EggTallyWidget.class));
        if (ids == null) return;
        for (int id : ids) mgr.updateAppWidget(id, build(context, id));
    }

    private static PendingIntent tapIntent(Context ctx, int widgetId, int delta, int slot) {
        Intent i = new Intent(ctx, EggTallyWidget.class);
        i.setAction(ACTION_TALLY);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        i.putExtra(EXTRA_DELTA, delta);
        // Unique request code per widget + button so the extras don't collide.
        int code = 40000 + (widgetId % 10000) * 4 + slot;
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static RemoteViews build(Context ctx, int widgetId) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_egg_tally);
        Flock flock = flockFor(ctx, widgetId);
        if (flock == null) {
            v.setTextViewText(R.id.tally_name, "🥚 Egg Counter");
            v.setTextViewText(R.id.tally_count, "–");
            v.setTextViewText(R.id.tally_sub, "Open Henalytics to add your flock");
        } else {
            int count = Math.max(0, flock.basket + pending(ctx, flock.id, localDay(new Date())));
            v.setTextViewText(R.id.tally_name, flock.emoji + " " + flock.name);
            v.setTextViewText(R.id.tally_count, String.valueOf(count));
            v.setTextViewText(R.id.tally_sub, flock.logged > 0 ? flock.logged + " more saved today" : "eggs today");
            v.setOnClickPendingIntent(R.id.tally_minus, tapIntent(ctx, widgetId, -1, 0));
            v.setOnClickPendingIntent(R.id.tally_plus, tapIntent(ctx, widgetId, 1, 1));
            v.setOnClickPendingIntent(R.id.tally_plus6, tapIntent(ctx, widgetId, 6, 2));
        }
        QuickLogWidget.bind(ctx, v, R.id.tally_header, "henalytics://open?page=egg_layers", 39000 + (widgetId % 1000));
        return v;
    }
}
