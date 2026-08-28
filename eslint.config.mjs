// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // 本專案未啟用 React Compiler。SDK 57 新增的編譯器專屬資料流推斷規則
      // 會把既有、已測試的 GPS 計時器與 Animated mutable-ref state machine 視為錯誤；
      // 仍保留 Expo、TypeScript 與 react-hooks 的其餘正確性規則。
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
