const { withBuildGradle, withAppBuildGradle } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Config Plugin: with-gradle-manifest-fix
 * 
 * 功能：
 * 1. 在 Gradle 構建過程中強制移除 BOOT_COMPLETED 廣播接收器
 * 2. 確保最終 APK/AAB 中不包含 BOOT_COMPLETED 廣播接收器
 * 3. 防止 expo-audio 在 BOOT_COMPLETED 時啟動前景服務
 */
module.exports = function withGradleManifestFix(config) {
  return withAppBuildGradle(config, async (config) => {
    const buildGradle = config.modResults.contents;

    // 檢查是否已添加任務
    if (buildGradle.includes("removeBootCompletedReceiver")) {
      return config;
    }

    // 添加自定義 Gradle 任務，在打包時移除 BOOT_COMPLETED 廣播接收器
    const customTask = `
// 自定義任務：移除 BOOT_COMPLETED 廣播接收器
afterEvaluate {
  android.applicationVariants.all { variant ->
    variant.outputs.all { output ->
      // 在 processResources 之後執行
      if (output.processResources) {
        output.processResources.doLast {
          // 找到 AndroidManifest.xml
          def manifestFile = new File(
            buildDir,
            "intermediates/processed_res/\${variant.dirName}/AndroidManifest.xml"
          )
          
          if (!manifestFile.exists()) {
            // 嘗試其他可能的位置
            manifestFile = new File(
              buildDir,
              "intermediates/packaged_res/\${variant.dirName}/AndroidManifest.xml"
            )
          }
          
          if (manifestFile.exists()) {
            def manifestContent = manifestFile.text
            
            // 移除包含 BOOT_COMPLETED 的廣播接收器
            manifestContent = manifestContent.replaceAll(
              /<receiver[^>]*>.*?<intent-filter>.*?<action\\s+android:name="android\\.intent\\.action\\.BOOT_COMPLETED"[^>]*>.*?<\\/intent-filter>.*?<\\/receiver>/s,
              ""
            )
            
            // 移除多餘的空白行
            manifestContent = manifestContent.replaceAll(/\\n\\s*\\n/, "\\n")
            
            manifestFile.text = manifestContent
          }
        }
      }
    }
  }
}
`;

    // 在文件末尾添加自定義任務
    config.modResults.contents = buildGradle + "\n" + customTask;

    return config;
  });
};
