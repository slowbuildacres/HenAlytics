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

## iPhone: one-time Xcode setup (about 5 minutes, on a Mac)

Apple only lets you add a widget target inside Xcode, so the Swift code is in
`ios/App/WidgetSource/HenalyticsWidget.swift`. Hook it up once:

1. `npm run build && npx cap sync ios && npx cap open ios`
2. **File → New → Target… → Widget Extension → Next.**
   - Product Name: `HenalyticsWidget`
   - Untick **Include Live Activity**, **Include Control**, and **Include Configuration App Intent**
   - Finish, then click **Activate** if asked.
3. In the left sidebar, open the new **HenalyticsWidget** folder. Select every `.swift` file Xcode made in it → right-click → **Delete → Move to Trash**. Keep `Info.plist` and `Assets.xcassets`.
4. Drag `ios/App/WidgetSource/HenalyticsWidget.swift` from Finder into that **HenalyticsWidget** folder in Xcode. In the dialog:
   - Tick **Copy items if needed**
   - Under targets, tick **HenalyticsWidget** only
5. Click the blue **App** project at the top of the sidebar → **HenalyticsWidget** target:
   - **General → Minimum Deployments:** iOS **17.0**
   - **Signing & Capabilities → Team:** the same team as the App target
6. Pick the **App** scheme and run on your phone. Long-press the home screen → **+** → Henalytics:
   - **Quick Log** (medium): eggs / fed / water / note
   - **One-Tap Log** (small, or Lock Screen): one button. Long-press → **Edit Widget** to choose what it logs.
7. Commit the Xcode changes (`ios/App/App.xcodeproj` and the new `ios/App/HenalyticsWidget/` folder) so you only do this once.

The main app still supports iOS 15. The widget shows up on iOS 17 and later.

## Changing the buttons

- iOS: edit `LogAction.url` in the Swift file
- Android: edit the `bind(...)` lines in `QuickLogWidget.java`
