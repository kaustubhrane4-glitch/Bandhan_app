# Keep JavaScript Bridge — CRITICAL
-keepclassmembers class app.bandhan.matrimony.BandhanBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keep class com.google.firebase.** { *; }
-keep class kotlin.** { *; }
-keepattributes SourceFile,LineNumberTable
