# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---- Henalytics (R8 on for release, see app/build.gradle) -------------------
# Readable crash stack traces in Play Console (the mapping file ships in the
# app bundle, so Play de-obfuscates them).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor finds plugins by class name (capacitor.plugins.json) and calls
# @PluginMethod methods by name. @capacitor/android's consumer rules already
# keep every Plugin subclass; this is a belt-and-braces line for ours.
-keep class com.henalytics.app.WidgetBridgePlugin { *; }

# The WebView ↔ native bridge (Capacitor's MessageHandler).
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
