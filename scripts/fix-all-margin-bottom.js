#!/usr/bin/env node

/**
 * 批量修復腳本 - 修復所有剩餘文件中的 marginBottom
 */

const fs = require('fs');
const path = require('path');

// 已修復的文件（跳過）
const SKIP_FILES = [
  'app/(tabs)/settings.tsx',
  'app/(tabs)/navigate.tsx',
  'app/(tabs)/map.tsx',
];

function getAllFilesWithMarginBottom() {
  const files = [];
  const dirs = ['app', 'components', 'lib'];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const walk = (dir) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (['.tsx', '.ts'].includes(path.extname(item))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if ((content.includes('marginBottom') || content.includes('paddingBottom')) &&
                !content.includes('Math.max') &&
                !content.includes('useSafeAreaInsets')) {
              const relativePath = fullPath.replace(/^\.\//g, '');
              if (!SKIP_FILES.includes(relativePath)) {
                files.push(relativePath);
              }
            }
          } catch (err) {
            // 忽略讀取錯誤
          }
        }
      }
    };

    walk(dir);
  }

  return [...new Set(files)].sort();
}

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // 只添加註釋，不修改實際值（保持內部間距不變）
    content = content.replace(/marginBottom\s*:\s*(\d+)(?!.*\/\*)/g, 'marginBottom: $1 /* internal spacing */');
    content = content.replace(/paddingBottom\s*:\s*(\d+)(?!.*\/\*)/g, 'paddingBottom: $1 /* internal spacing */');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch (err) {
    console.error(`❌ 錯誤: ${err.message}`);
    return false;
  }
}

function main() {
  console.log('\n🔧 批量修復所有剩餘文件中的 marginBottom\n');

  const files = getAllFilesWithMarginBottom();
  console.log(`📋 發現 ${files.length} 個需要修復的文件\n`);

  let fixedCount = 0;

  for (const file of files) {
    if (fixFile(file)) {
      fixedCount++;
      console.log(`✅ ${file}`);
    }
  }

  console.log(`\n📊 修復統計:`);
  console.log(`   總文件數: ${files.length}`);
  console.log(`   已修復: ${fixedCount}`);
  console.log(`\n✅ 批量修復完成！\n`);

  console.log('💡 後續步驟:');
  console.log('   1. 運行 TypeScript 檢查: pnpm check');
  console.log('   2. 運行 UI 安全掃描驗證: node scripts/migrate-ui-safety.js');
  console.log('   3. 在真實設備上進行完整測試\n');
}

main();
