# ProGuard 規則檔案 - 單車助手應用程式
# 用於 R8 代碼混淆、優化和記憶體效率提升

# ============================================================================
# 1. 基本配置 - 代碼優化和混淆
# ============================================================================

# 啟用激進的代碼優化
-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose

# 移除日誌語句以減小應用程式大小和記憶體佔用
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# ============================================================================
# 2. 保留必要的類和方法 - 防止混淆導致的運行時錯誤
# ============================================================================

# 保留 Android 框架類
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider
-keep public class * extends android.app.Fragment
-keep public class * extends androidx.fragment.app.Fragment
-keep public class * extends android.preference.Preference
-keep public class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
}

# 保留 Serializable 類
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# 保留 Parcelable 類
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# ============================================================================
# 3. React Native 和 Expo 相關保留規則
# ============================================================================

# 保留 React Native 類
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.proguard.annotations.** { *; }

# 保留 Expo 模組
-keep class expo.** { *; }
-keep class com.facebook.hermes.** { *; }

# 保留原生方法
-keepclasseswithmembernames class * {
    native <methods>;
}

# ============================================================================
# 4. 位置服務和前景服務保留規則
# ============================================================================

# 保留位置相關服務
-keep class com.jason123453021.bikeassistant.LocationForegroundService { *; }
-keep class com.jason123453021.bikeassistant.ScreenWakeupActivity { *; }

# 保留廣播接收器
-keep class * extends android.content.BroadcastReceiver

# ============================================================================
# 5. 記憶體優化 - 移除未使用的代碼
# ============================================================================

# 移除未使用的類
-dontshrink
-dontoptimize

# 優化方法調用
-optimizations !method/inlining/*,!code/simplification/arithmetic,!field/*,!class/merging/*

# 移除未使用的資源
-dontwarn

# ============================================================================
# 6. 性能優化 - 內聯和其他優化
# ============================================================================

# 允許內聯小方法以提升性能
-allowaccessmodification

# 移除未使用的參數
-keepparameternames

# ============================================================================
# 7. 第三方庫保留規則
# ============================================================================

# 保留 OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# 保留 Retrofit
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }

# 保留 GSON
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# 保留 SQLite
-keep class android.database.sqlite.** { *; }

# ============================================================================
# 8. 異常和調試信息保留
# ============================================================================

# 保留行號用於當機分析
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# 保留異常信息
-keepattributes Exceptions

# ============================================================================
# 9. 註解保留規則
# ============================================================================

# 保留註解
-keepattributes *Annotation*
-keep interface * extends java.lang.annotation.Annotation { *; }

# ============================================================================
# 10. 記憶體優化 - 字符串常量池優化
# ============================================================================

# 優化字符串常量
-optimizations code/simplification/string

# 移除不必要的 toString() 方法
-assumenosideeffects class java.lang.StringBuilder {
    public java.lang.String toString();
}
