package com.henalytics.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Picks which flock an Egg Counter widget counts. Opened by the launcher when
 * the widget is placed or reconfigured (res/xml/widget_egg_tally_info.xml).
 * Lists the flocks from the app's widget snapshot; with none yet, it says to
 * open Henalytics first.
 */
public class EggTallyConfigActivity extends Activity {

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Backing out without a choice cancels placement.
        setResult(RESULT_CANCELED);

        Intent intent = getIntent();
        Bundle extras = intent != null ? intent.getExtras() : null;
        if (extras != null) {
            widgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        final List<EggTallyWidget.Flock> flocks = EggTallyWidget.flocks(this);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);
        root.setBackgroundColor(0xFFF4EDE0);

        TextView title = new TextView(this);
        title.setText(flocks.isEmpty() ? "No flocks yet" : "Which flock is this counter for?");
        title.setTextSize(20);
        title.setTextColor(0xFF2C1810);
        title.setPadding(0, 0, 0, pad / 2);
        root.addView(title);

        if (flocks.isEmpty()) {
            TextView msg = new TextView(this);
            msg.setText("Open Henalytics and add your egg-laying flock, then add this widget again.");
            msg.setTextSize(15);
            msg.setTextColor(0xFF5C4530);
            root.addView(msg);
            setContentView(root);
            return;
        }

        List<String> labels = new ArrayList<>();
        for (EggTallyWidget.Flock f : flocks) labels.add(f.emoji + "  " + f.name);
        ListView list = new ListView(this);
        list.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, labels));
        list.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                pick(flocks.get(position).id);
            }
        });
        root.addView(list, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        root.setGravity(Gravity.TOP);
        setContentView(root);
    }

    private void pick(String flockId) {
        EggTallyWidget.setFlock(this, widgetId, flockId);
        AppWidgetManager mgr = AppWidgetManager.getInstance(this);
        mgr.updateAppWidget(widgetId, EggTallyWidget.build(this, widgetId));
        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, result);
        finish();
    }
}
