// ============================================================================
// AppIcon: lets supporters pick an alternate home-screen icon (3.0).
// ----------------------------------------------------------------------------
// The icons live in Assets.xcassets as AppIcon-<Name>.appiconset (one 1024px
// image each); the build settings ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES
// and ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS put them in the app.
// The web app (src/newlook/appIcon.js) calls AppIcon.set({ name }) with
// "default" or one of those names. iOS shows its own "You have changed the
// icon" alert afterwards; that is expected.
// ============================================================================

import Foundation
import Capacitor
import UIKit

@objc(AppIconPlugin)
public class AppIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIconPlugin"
    public let jsName = "AppIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    static let allowed: Set<String> = ["Meadow", "Barn", "Night", "Spring", "Summer", "Fall", "Winter"]

    @objc func get(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "supported": UIApplication.shared.supportsAlternateIcons,
                "name": UIApplication.shared.alternateIconName ?? "default"
            ])
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        let raw = call.getString("name") ?? "default"
        let name: String? = raw == "default" ? nil : raw
        if let n = name, !AppIconPlugin.allowed.contains(n) {
            call.reject("Unknown icon")
            return
        }
        DispatchQueue.main.async {
            guard UIApplication.shared.supportsAlternateIcons else {
                call.reject("Alternate icons aren't supported on this device")
                return
            }
            if UIApplication.shared.alternateIconName == name {
                call.resolve(["name": raw])
                return
            }
            UIApplication.shared.setAlternateIconName(name.map { "AppIcon-\($0)" }) { error in
                if let error = error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve(["name": raw])
                }
            }
        }
    }
}
