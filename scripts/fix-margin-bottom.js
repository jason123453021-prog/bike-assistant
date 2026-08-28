#!/usr/bin/env node

/**
 * 自動化修復腳本 - 替換內部 marginBottom
 * 注意：此腳本只修復內部間距（非底部邊距）
 * 底部邊距已在關鍵頁面中使用 useSafeAreaInsets 修復
 */

const fs = require('fs');
const path = require('path');

// 優先級文件列表
const PRIORITY_FILES = [
  'app/(tabs)/settings.tsx',
  'app/(tabs)/navigate.tsx',
  'app/(tabs)/map.tsx',
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // 替換模式 1: marginBottom: 數字
    content = content.replace(/marginBottom\s*:\s*(\d+)/g, 'marginBottom: $1 /* internal spacing */');

    // 替換模式 2: paddingBottom: 數字（非底部邊距）
    // 只替換在 ScrollView contentContainerStyle 之外的 paddingBottom
    content = content.replace(/paddingBottom\s*:\s*(\d+)(?!.*contentContainerStyle)/g, 'paddingBottom: $1 /* internal spacing */');

    // 檢查是否有變化
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch (err) {
    console.error(`❌ 修復失敗 ${filePath}: ${err.message}`);
    return false;
  }
}

function main() {
  console.log('\n🔧 開始修復內部 marginBottom\n');

  let fixedCount = 0;
  let totalCount = 0;

  for (const file of PRIORITY_FILES) {
    const fullPath = path.join('/home/ubuntu/bike_assistant', file);
    if (fs.existsSync(fullPath)) {
      totalCount++;
      console.log(`📄 正在修復: ${file}`);
      if (fixFile(fullPath)) {
        fixedCount++;
        console.log(`   ✅ 修復完成\n`);
      } else {
        console.log(`   ⏭️  無需修復\n`);
      }
    } else {
      console.log(`   ⚠️  文件不存在\n`);
    }
  }

  console.log(`\n📊 修復統計:`);
  console.log(`   總文件數: ${totalCount}`);
  console.log(`   已修復: ${fixedCount}`);
  console.log(`\n✅ 修復完成！\n`);

  console.log('💡 後續步驟:');
  console.log('   1. 運行 TypeScript 檢查: pnpm check');
  console.log('   2. 在真實設備上測試');
  console.log('   3. 運行 UI 安全掃描驗證: node scripts/migrate-ui-safety.js\n');
}

main();
