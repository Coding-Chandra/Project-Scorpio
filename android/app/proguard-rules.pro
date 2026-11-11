# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep public class * extends com.getcapacitor.Plugin {
    public *;
}
-keep public class com.getcapacitor.** { *; }
-keep class com.aparajita.capacitor.biometricauth.** { *; }
-dontwarn com.aparajita.capacitor.biometricauth.**
