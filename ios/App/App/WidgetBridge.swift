// ============================================================================
// WidgetBridge: hands the "Today" widget its data.
// ----------------------------------------------------------------------------
// The web app (src/widgetBridge.js) calls WidgetBridge.setToday({ json })
// whenever eggs, flocks, calendar items or the frost outlook change, and
// WidgetBridge.takeTally() to collect egg tally widget taps. We store the JSON
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
        CAPPluginMethod(name: "setToday", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeTally", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.com.henalytics.app"

    override public func load() {
        // A Siri voice log (VoiceIntents.swift) just added eggs to the tally:
        // tell the web layer so an already-open app folds them in now.
        NotificationCenter.default.addObserver(self, selector: #selector(voiceTallyChanged),
                                               name: .henTallyChanged, object: nil)
    }

    @objc private func voiceTallyChanged() {
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("tallyChanged", data: [:])
        }
    }

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
        // Today + Egg Tally both read this snapshot.
        WidgetCenter.shared.reloadAllTimelines()
        // Flock names feed Siri's "Log eggs for <flock>" phrase.
        if #available(iOS 17.0, *) {
            HenalyticsShortcuts.updateAppShortcutParameters()
        }
        call.resolve(["ok": true])
    }

    /// Egg tally widget: return the taps it has collected
    /// ({ flockId: { "YYYY-MM-DD": n } } as JSON) and clear them. The web app
    /// folds them into the flocks' egg baskets (src/widgetBridge.js).
    @objc func takeTally(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroup) else {
            call.resolve(["json": ""])
            return
        }
        let json = defaults.string(forKey: "eggTally") ?? ""
        if !json.isEmpty {
            defaults.removeObject(forKey: "eggTally")
        }
        call.resolve(["json": json])
    }
}

/// Root view controller: the stock Capacitor bridge plus our in-app plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(AppIconPlugin())
    }
}
