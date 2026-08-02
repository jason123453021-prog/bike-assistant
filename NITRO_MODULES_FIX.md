# Android 原生 C++ 編譯失敗修復指南

## 問題描述

在 EAS Build 進行 Android Release 打包時，`react-native-nitro-modules` 原生模組編譯失敗：

```
[23/24] Building CXX object
CMakeFiles/NitroModules.dir/tmp/expo-builds/.../cpp/utils/CommonGlobals.cpp.o
[24/24] Building CXX object
CMakeFiles/NitroModules.dir/tmp/expo-builds/.../cpp/entrypoint/HybridNitroModulesProxy.cpp.o
ninja: build stopped: subcommand failed.
C++ build system [build] failed while executing:
/opt/android-sdk/cmake/3.22.1/bin/ninja
```

## 根本原因

1. **CMake 3.22.1 與 NDK 工具鏈不相容**
2. **C++ 標準庫版本衝突**（libc++ vs libstdc++）
3. **ARM64 ABI 特定編譯問題**
4. **React Compiler 與 NitroModules 互動衝突**

## 實施的修復方案

### 1. app.config.ts 修改

```typescript
// 禁用 React Compiler（可能導致編譯問題）
experiments: {
  typedRoutes: true,
  reactCompiler: false,  // 從 true 改為 false
},

// 調整 C++ 編譯設定
[
  "expo-build-properties",
  {
    android: {
      buildArchs: ["arm64-v8a"],  // 移除 armeabi-v7a，僅保留 arm64-v8a
      minSdkVersion: 24,           // 從 36 降低至 24
      targetSdkVersion: 36,
      cppStandard: "c++17",        // 指定 C++17 標準
      useClang: true,              // 使用 Clang 編譯器
      enableLto: false,            // 禁用 LTO 優化
    },
  },
],
```

### 2. eas.json 修改

在 `preview` 和 `production` 配置中添加環境變數：

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "aab",
        "env": {
          "GRADLE_OPTS": "-Xmx4096m -XX:+UseG1GC",
          "ORG_GRADLE_PROJECT_android_cppStandard": "c++17",
          "ORG_GRADLE_PROJECT_android_useClang": "true",
          "ORG_GRADLE_PROJECT_android_enableLto": "false"
        }
      }
    },
    "preview": {
      "android": {
        "buildType": "apk",
        "env": {
          "GRADLE_OPTS": "-Xmx4096m -XX:+UseG1GC",
          "ORG_GRADLE_PROJECT_android_cppStandard": "c++17",
          "ORG_GRADLE_PROJECT_android_useClang": "true",
          "ORG_GRADLE_PROJECT_android_enableLto": "false"
        }
      }
    }
  }
}
```

## 修復原理

| 修改項 | 原因 |
|------|------|
| `reactCompiler: false` | React Compiler 與 NitroModules 編譯流程衝突 |
| `buildArchs: ["arm64-v8a"]` | 移除 armeabi-v7a 減少編譯複雜度，arm64-v8a 已覆蓋 99% 現代設備 |
| `minSdkVersion: 24` | 提高相容性，避免 NDK 工具鏈版本衝突 |
| `cppStandard: "c++17"` | C++17 相容性最佳，避免 C++20 編譯問題 |
| `useClang: true` | Clang 編譯器對 NDK 支援更好 |
| `enableLto: false` | 禁用 LTO 加快編譯，避免編譯器優化導致的問題 |
| `GRADLE_OPTS: "-Xmx4096m"` | 分配足夠的 JVM 堆內存 |

## 驗證步驟

### 本地測試

```bash
# 清理構建
eas build --platform android --profile preview --clear-cache

# 或直接使用 EAS Build
eas build --platform android --profile preview
```

### 預期結果

- ✅ CMake 編譯階段順利完成
- ✅ Ninja 編譯 NitroModules 成功
- ✅ 最終產出 APK/AAB 檔案
- ✅ 實機安裝無閃退

## 如果問題仍未解決

### 方案 A：完全禁用 NitroModules

在 app.json 中添加：

```json
{
  "plugins": [
    [
      "expo-build-properties",
      {
        "android": {
          "enableNitroModules": false
        }
      }
    ]
  ]
}
```

### 方案 B：降級 Expo SDK

如果 Expo SDK 54 與 NitroModules 存在已知不相容問題，考慮降級至 Expo SDK 53：

```bash
npx expo@53 upgrade
```

### 方案 C：使用 Expo Dev Client

避免使用 Expo Go，改用 Expo Dev Client 以獲得更好的原生編譯控制：

```bash
eas build --platform android --profile dev-client
```

## 相關資源

- [Expo Build Properties](https://docs.expo.dev/build-reference/build-properties/)
- [React Native NDK 相容性](https://reactnative.dev/docs/native-modules-android)
- [CMake 與 Ninja 編譯指南](https://cmake.org/cmake/help/latest/manual/cmake.1.html)

## 聯繫支援

如果問題仍未解決，請收集以下信息並聯繫 Expo 支援：

1. 完整的 EAS Build 日誌（包含 `--verbose` 輸出）
2. `package.json` 和 `app.config.ts` 配置
3. 本地環境信息（Node.js 版本、Expo CLI 版本）
