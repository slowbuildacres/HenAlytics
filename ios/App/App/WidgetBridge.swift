// ============================================================================
// WidgetBridge: hands the "Today" widget its data.
// ----------------------------------------------------------------------------
// The web app (src/widgetBridge.js) calls WidgetBridge.setToday({ json })
// whenever eggs, calendar items or the frost outlook change. We store the JSON
// in the shared App Group (group.com.henalytics.app, key "today"), where
// HenalyticsWidget.swift reads it, and ask WidgetKit to redraw the widget.
//
// Registered in MainViewController below (Main.storyboard uses it as the
// root view controller instead of the stock CAPBridgeViewController).
// ============================================================================

import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setToday", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.com.henalytics.app"

    @objc func setToday(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), json.count < 20_000 else {
            call.reject("Missing or oversized snapshot")
            return
        }
        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroup) else {
            call.reject("App Group not available")
            return
        }
        defaults.set(json, forKey: "today")
        WidgetCenter.shared.reloadTimelines(ofKind: "HenalyticsToday")
        call.resolve(["ok": true])
    }
}

/// Root view controller: the stock Capacitor bridge plus our in-app plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
