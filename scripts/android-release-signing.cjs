const { readFileSync, writeFileSync } = require("node:fs");

const REQUIRED_ENV = [
  "PLAY_UPLOAD_KEYSTORE_PATH",
  "PLAY_UPLOAD_KEYSTORE_PASSWORD",
  "PLAY_UPLOAD_KEY_ALIAS",
  "PLAY_UPLOAD_KEY_PASSWORD",
];

function applyAndroidReleaseSigningConfig(source) {
  const releaseSignature = [
    "release {",
    "            storeFile file(System.getenv('PLAY_UPLOAD_KEYSTORE_PATH'))",
    "            storePassword System.getenv('PLAY_UPLOAD_KEYSTORE_PASSWORD')",
    "            keyAlias System.getenv('PLAY_UPLOAD_KEY_ALIAS')",
    "            keyPassword System.getenv('PLAY_UPLOAD_KEY_PASSWORD')",
    "        }",
  ].join("\n");

  if (!source.includes("signingConfigs {") || !source.includes("buildTypes {")) {
    throw new Error("找不到 Android Gradle 的 signingConfigs 或 buildTypes 區塊。");
  }

  const withReleaseConfig = source.replace(
    "signingConfigs {\n        debug {",
    `signingConfigs {\n        ${releaseSignature}\n        debug {`,
  );

  if (withReleaseConfig === source) {
    throw new Error("無法插入 Play release signingConfig；Gradle 範本已變更。");
  }

  const buildTypesIndex = withReleaseConfig.indexOf("buildTypes {");
  if (buildTypesIndex === -1) {
    throw new Error("找不到 Android Gradle 的 buildTypes 區塊。");
  }

  const beforeBuildTypes = withReleaseConfig.slice(0, buildTypesIndex);
  const buildTypesAndAfter = withReleaseConfig.slice(buildTypesIndex);
  const signedBuildTypes = buildTypesAndAfter.replace(
    /(release\s*\{[\s\S]*?)(signingConfig signingConfigs\.debug)/,
    "$1signingConfig signingConfigs.release",
  );
  const signedRelease = beforeBuildTypes + signedBuildTypes;

  if (signedBuildTypes === buildTypesAndAfter) {
    throw new Error("無法將 release buildType 指向 Play upload key。");
  }

  return signedRelease;
}

function configureReleaseSigning() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`缺少 Play upload key 設定：${missing.join(", ")}`);
  }

  const gradlePath = process.argv[2] ?? "android/app/build.gradle";
  const source = readFileSync(gradlePath, "utf8");
  writeFileSync(gradlePath, applyAndroidReleaseSigningConfig(source));
}

if (require.main === module) {
  configureReleaseSigning();
}

module.exports = { applyAndroidReleaseSigningConfig };
