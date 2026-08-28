const {
  createRunOncePlugin,
  withAppBuildGradle,
  withGradleProperties,
} = require("@expo/config-plugins");

const LEGACY_DEFAULT_PROGUARD = 'getDefaultProguardFile("proguard-android.txt")';
const OPTIMIZED_DEFAULT_PROGUARD = 'getDefaultProguardFile("proguard-android-optimize.txt")';

/**
 * Expo SDK 54 的 Android 範本使用 proguard-android.txt，其中含有 -dontoptimize。
 * 對 release AAB 使用官方 optimize 規則，讓既有的 minifyEnabled + shrinkResources
 * 真正啟動 R8 的最佳化階段；debug 變體不受影響。
 */
function applyReleaseOptimization(buildGradle) {
  if (buildGradle.includes(OPTIMIZED_DEFAULT_PROGUARD)) return buildGradle;
  if (!buildGradle.includes(LEGACY_DEFAULT_PROGUARD)) {
    throw new Error("找不到 Android release 的預設 ProGuard 檔案設定。");
  }
  return buildGradle.replace(LEGACY_DEFAULT_PROGUARD, OPTIMIZED_DEFAULT_PROGUARD);
}

function enableOptimizedResourceShrinking(gradleProperties) {
  const key = "android.r8.optimizedResourceShrinking";
  const existing = gradleProperties.find(
    (property) => property.type === "property" && property.key === key,
  );
  if (existing) {
    existing.value = "true";
    return gradleProperties;
  }
  return [...gradleProperties, { type: "property", key, value: "true" }];
}

function withAndroidReleaseOptimization(config) {
  const withOptimizedProguard = withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== "groovy") {
      throw new Error("僅支援 Expo 產生的 Groovy Android build.gradle。");
    }
    modConfig.modResults.contents = applyReleaseOptimization(modConfig.modResults.contents);
    return modConfig;
  });
  return withGradleProperties(withOptimizedProguard, (modConfig) => {
    modConfig.modResults = enableOptimizedResourceShrinking(modConfig.modResults);
    return modConfig;
  });
}

module.exports = createRunOncePlugin(
  withAndroidReleaseOptimization,
  "bike-assistant-release-optimization",
  "1.0.0",
);
module.exports.applyReleaseOptimization = applyReleaseOptimization;
module.exports.enableOptimizedResourceShrinking = enableOptimizedResourceShrinking;
