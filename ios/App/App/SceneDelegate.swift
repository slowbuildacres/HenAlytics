// ============================================================================
// SceneDelegate: required for apps built with the iOS 27 SDK (Xcode 27).
// ----------------------------------------------------------------------------
// Apps built with Xcode 27 that don't adopt the UIScene life cycle are killed
// at launch on iOS 27 ("UIScene life cycle is required for apps built with
// this SDK"). This follows Capacitor 8.6's own iOS template: the scene owns
// the window, and SceneDelegateProxy forwards URL opens (henalytics:// widget
// and reminder links, OAuth callbacks) and universal links to Capacitor.
//
// Info.plist names this class in UIApplicationSceneManifest with
// UISceneStoryboardFile = Main, so UIKit normally builds the window from
// Main.storyboard (root: MainViewController, which registers our plugins).
// The fallback below only runs if that didn't happen.
// ============================================================================

import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        if window == nil {
            let newWindow = UIWindow(windowScene: windowScene)
            newWindow.rootViewController = MainViewController()
            window = newWindow
        }
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
