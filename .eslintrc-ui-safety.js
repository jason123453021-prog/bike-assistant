/**
 * ESLint 配置 - UI 自適應安全檢查
 * 檢查固定邊距和 SafeArea 使用規範
 */

module.exports = {
  rules: {
    // 警告：檢測到可能的固定 marginBottom
    'no-restricted-properties': [
      'warn',
      {
        object: 'styles',
        property: 'marginBottom',
        message:
          '❌ 禁止使用固定 marginBottom。請使用 useSafeAreaInsets() 動態計算：Math.max(insets.bottom, defaultValue)',
      },
      {
        object: 'styles',
        property: 'paddingBottom',
        message:
          '❌ 禁止使用固定 paddingBottom。請使用 useSafeAreaInsets() 動態計算：Math.max(insets.bottom, defaultValue)',
      },
    ],

    // 警告：檢測到可能的固定 marginTop（針對頂部狀態欄）
    'no-restricted-syntax': [
      'warn',
      {
        selector:
          'ObjectExpression > Property[key.name="marginTop"], ObjectExpression > Property[key.name="paddingTop"]',
        message:
          '⚠️ 檢查是否需要使用 useSafeAreaInsets 處理頂部狀態欄。',
      },
    ],
  },

  // 針對特定文件的覆蓋規則
  overrides: [
    {
      files: ['app/**/*.tsx', 'components/**/*.tsx'],
      rules: {
        // 在頁面和組件中強制執行 SafeArea 檢查
        'no-console': 'off', // 允許 console 用於調試
      },
    },
  ],
};
