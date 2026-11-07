package com.henalytics.app;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Receives the widget snapshot from the web app (src/widgetBridge.js) and
 * refreshes the Today and Egg Counter widgets; hands Egg Counter taps back
 * to the app (takeTally). Registered in MainActivity.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void setToday(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.length() > 20000) {
            call.reject("Missing or oversized snapshot");
            return;
        }
        Context ctx = getContext();
        ctx.getSharedPreferences(TodayWidget.PREFS, Context.MODE_PRIVATE)
                .edit().putString(TodayWidget.KEY, json).apply();
        TodayWidget.refreshAll(ctx);
        EggTallyWidget.refreshAll(ctx);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    /** Egg Counter taps waiting for the app (JSON), cleared once taken. */
    @PluginMethod
    public void takeTally(PluginCall call) {
        String json = EggTallyWidget.take(getContext());
        JSObject ret = new JSObject();
        ret.put("json", json);
        call.resolve(ret);
    }
}
