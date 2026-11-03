# Home-screen widgets

Each widget button opens the app straight into a log form. The app side is in
`src/HomesteadApp.jsx` (search for `WIDGET DEEP LINKS`).

Links look like `henalytics://log?hobby=<hobby id>&action=<action>`.
Allowed actions: `eggs`, `fed`, `watered`, `note`, `bedding`, `sold_eggs`, `used_eggs`.
`hobby=any` opens whichever hobby was in use last. `henalytics://open` just opens the app.

## Android: already wired in

- `android/app/src/main/java/com/henalytics/app/QuickLogWidget.java`
- `res/layout/widget_quick_log.xml`, `res/xml/widget_quick_log_info.xml`,
  `res/drawable/widget_bg.xml`, `res/drawable/widget_btn_bg.xml`, `res/values/widget_styles.xml`
- `<receiver>` added in `AndroidManifest.xml`

To ship it:

```bash
npm run build
npx cap sync android
npx cap open android
```

Then bump `versionCode` / `versionName` and build a signed bundle (Build → Generate Signed App Bundle). Upload it to Play Console.

To try it: install the build, long-press the home screen → Widgets → Henalytics → **Quick Log** (4×1).

## iPhone: already wired in

The Xcode project (`ios/App/App.xcodeproj`) has a **HenalyticsWidget** widget
extension target (iOS 17+, bundle ID `com.henalytics.app.HenalyticsWidget`),
embedded in the App target:

- `ios/App/HenalyticsWidget/HenalyticsWidget.swift`: the widgets
- `ios/App/HenalyticsWidget/Info.plist`: marks it as a WidgetKit extension

The App target also has `ios/App/App/App.entitlements` with
`webcredentials:henalytics.com`, so iPhone users get their passwords saved for
henalytics.com offered at sign-in (pairs with `public/.well-known/apple-app-site-association`).

To ship it:

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Then in Xcode pick the **App** scheme → **Product → Archive**. With automatic
signing, Xcode registers the widget's App ID and refreshes the profiles on the
first build (it may ask you to sign in to your Apple account once).

To try it: long-press the home screen → **+** → Henalytics:
- **Quick Log** (medium): eggs / fed / water / note
- **One-Tap Log** (small, or Lock Screen): one button. Long-press → **Edit Widget** to choose what it logs.

The main app still supports iOS 15. The widget shows up on iOS 17 and later.

**Version numbers:** the widget's version must match the app's. Both targets
carry `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`, so bump them together
(a find-and-replace across `project.pbxproj` does it).

## Changing the buttons

- iOS: edit `LogAction.url` in the Swift file
- Android: edit the `bind(...)` lines in `QuickLogWidget.java`
