// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  applyReleaseOptimization,
  enableOptimizedResourceShrinking,
} = require("../../plugins/with-android-release-optimization.cjs");

describe("Android 正式版 R8 最佳化設定", () => {
  it("將 Expo release 的非最佳化預設規則切換為 R8 最佳化規則", () => {
    const input = [
      "release {",
      '  proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"',
      "}",
    ].join("\n");

    expect(applyReleaseOptimization(input)).toContain(
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    );
  });

  it("重複執行時保持冪等", () => {
    const optimized =
      'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"';
    expect(applyReleaseOptimization(optimized)).toBe(optimized);
  });

  it("無法辨識 Expo release 範本時明確失敗", () => {
    expect(() => applyReleaseOptimization("release { } ")).toThrow(
      "找不到 Android release 的預設 ProGuard 檔案設定。",
    );
  });

  it("寫入 AGP 8.12 所需的最佳化資源縮減開關", () => {
    expect(enableOptimizedResourceShrinking([])).toEqual([
      {
        type: "property",
        key: "android.r8.optimizedResourceShrinking",
        value: "true",
      },
    ]);
  });

  it("覆寫既有的最佳化資源縮減關閉值", () => {
    const result = enableOptimizedResourceShrinking([
      {
        type: "property",
        key: "android.r8.optimizedResourceShrinking",
        value: "false",
      },
    ]);
    expect(result[0].value).toBe("true");
  });
});
