#!/bin/bash

# ============================================================================
# Quick Build Script for Bike Assistant Dev APK
# 一鍵編譯開發版 APK 的快速腳本
# ============================================================================

set -e  # 任何命令失敗都會停止執行

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印帶顏色的信息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ============================================================================
# 1. 環境檢查
# ============================================================================
print_info "開始編譯流程..."
print_info "步驟 1/6：檢查環境"

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js 未安裝，請先安裝 Node.js"
    exit 1
fi
print_success "Node.js 已安裝：$(node --version)"

# 檢查 pnpm
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm 未安裝，請先安裝 pnpm"
    exit 1
fi
print_success "pnpm 已安裝：$(pnpm --version)"

# 檢查 EAS CLI
if ! command -v eas &> /dev/null; then
    print_warning "EAS CLI 未安裝，正在安裝..."
    npm install -g eas-cli
fi
print_success "EAS CLI 已安裝：$(eas --version)"

# 檢查 EAS 登錄狀態
if ! eas whoami &> /dev/null; then
    print_warning "未登錄 Expo 帳戶，正在進行登錄..."
    eas login
fi
print_success "Expo 帳戶已登錄"

# ============================================================================
# 2. 進入項目目錄
# ============================================================================
print_info "步驟 2/6：進入項目目錄"
cd "$(dirname "$0")"
PROJECT_DIR=$(pwd)
print_success "項目目錄：$PROJECT_DIR"

# ============================================================================
# 3. 清理舊的編譯產物
# ============================================================================
print_info "步驟 3/6：清理舊的編譯產物"
rm -rf dist/ .expo/ node_modules/.cache
print_success "清理完成"

# ============================================================================
# 4. 安裝依賴
# ============================================================================
print_info "步驟 4/6：安裝依賴"
pnpm install
print_success "依賴安裝完成"

# ============================================================================
# 5. 執行 EAS Build
# ============================================================================
print_info "步驟 5/6：執行 EAS Build（開發版 APK）"
print_warning "這可能需要 5-15 分鐘，請耐心等待..."

# 執行編譯
if eas build --platform android --profile development --wait; then
    print_success "編譯成功！"
else
    print_error "編譯失敗，請檢查上面的錯誤信息"
    exit 1
fi

# ============================================================================
# 6. 下載 APK
# ============================================================================
print_info "步驟 6/6：下載 APK"

# 獲取最新編譯的 Build ID
LATEST_BUILD=$(eas build:list --platform android --limit 1 --json | jq -r '.[0].id')

if [ -z "$LATEST_BUILD" ]; then
    print_error "無法獲取編譯 ID"
    exit 1
fi

print_info "最新編譯 ID：$LATEST_BUILD"

# 下載 APK
APK_PATH="$PROJECT_DIR/bike_assistant_dev.apk"
print_info "正在下載 APK 到：$APK_PATH"

if eas build:download "$LATEST_BUILD" --path "$APK_PATH"; then
    print_success "APK 下載完成！"
    print_success "APK 路徑：$APK_PATH"
    print_success "APK 大小：$(du -h "$APK_PATH" | cut -f1)"
else
    print_error "APK 下載失敗"
    exit 1
fi

# ============================================================================
# 完成
# ============================================================================
print_success "編譯流程完成！"
echo ""
echo -e "${BLUE}========== 下一步 ==========${NC}"
echo "1. 連接 Android 設備並啟用 USB 調試"
echo "2. 執行以下命令安裝 APK："
echo -e "   ${YELLOW}adb install -r $APK_PATH${NC}"
echo "3. 啟動應用："
echo -e "   ${YELLOW}adb shell am start -n com.bikeassistant/.MainActivity${NC}"
echo "4. 查看日誌："
echo -e "   ${YELLOW}adb logcat | grep bike_assistant${NC}"
echo ""
print_info "更多幫助請查看 EAS_BUILD_GUIDE.md"
