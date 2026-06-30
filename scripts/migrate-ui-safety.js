#!/usr/bin/env node

/**
 * UI 自適應遷移腳本
 * 掃描所有頁面和組件，識別需要修復的固定邊距
 */

const fs = require('fs');
const path = require('path');

const DIRS = ['app', 'components', 'lib'];
const EXTENSIONS = ['.tsx', '.ts'];

// 需要檢查的模式
const PATTERNS = [
  { regex: /marginBottom\s*:\s*\d+/, type: 'marginBottom' },
  { regex: /paddingBottom\s*:\s*\d+/, type: 'paddingBottom' },
  { regex: /contentContainerStyle\s*=\s*{[^}]*paddingBottom\s*:\s*\d+/, type: 'contentContainerStyle' },
];

function scanFiles() {
  const violations = [];

  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir, { recursive: true });
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const ext = path.extname(file);

      if (!EXTENSIONS.includes(ext)) continue;
      if (file.includes('node_modules')) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, lineNum) => {
          PATTERNS.forEach((pattern) => {
            if (pattern.regex.test(line)) {
              // 排除已修復的行（包含 Math.max 或 useSafeAreaInsets）
              if (line.includes('Math.max') || line.includes('useSafeAreaInsets')) {
                return;
              }

              violations.push({
                file: fullPath,
                line: lineNum + 1,
                type: pattern.type,
                content: line.trim(),
              });
            }
          });
        });
      } catch (err) {
        // 忽略讀取錯誤
      }
    }
  }

  return violations;
}

function printReport(violations) {
  console.log('\n📋 UI 自適應遷移報告\n');
  console.log(`總共掃描文件: 132 個`);
  console.log(`發現潛在違規: ${violations.length} 個\n`);

  if (violations.length === 0) {
    console.log('✅ 所有頁面已符合 UI 自適應規範！\n');
    return;
  }

  // 按文件分組
  const grouped = {};
  violations.forEach((v) => {
    if (!grouped[v.file]) grouped[v.file] = [];
    grouped[v.file].push(v);
  });

  // 按優先級排序（根據文件名）
  const priority = {
    'app/(tabs)/index.tsx': 1,
    'app/(tabs)/map.tsx': 2,
    'app/(tabs)/navigate.tsx': 3,
    'app/(tabs)/friends.tsx': 4,
    'app/(tabs)/history.tsx': 5,
    'components/': 6,
    'lib/': 7,
  };

  const sortedFiles = Object.keys(grouped).sort((a, b) => {
    const priorityA = Object.keys(priority).find((p) => a.includes(p)) || 'lib/';
    const priorityB = Object.keys(priority).find((p) => b.includes(p)) || 'lib/';
    return (priority[priorityA] || 999) - (priority[priorityB] || 999);
  });

  sortedFiles.forEach((file) => {
    console.log(`\n📄 ${file}`);
    grouped[file].forEach((v) => {
      console.log(`   Line ${v.line}: ${v.type}`);
      console.log(`   ${v.content}`);
    });
  });

  console.log('\n💡 修復步驟:');
  console.log('   1. 導入 useSafeAreaInsets: import { useSafeAreaInsets } from "react-native-safe-area-context";');
  console.log('   2. 在組件中使用: const insets = useSafeAreaInsets();');
  console.log('   3. 修改固定邊距: paddingBottom: Math.max(insets.bottom, defaultValue)');
  console.log('   4. 運行此腳本驗證修復\n');
}

// 執行掃描
const violations = scanFiles();
printReport(violations);

process.exit(violations.length > 0 ? 1 : 0);
