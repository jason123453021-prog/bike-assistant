#!/bin/bash

# Android 設備完整測試執行腳本
# 用途：自動化執行所有測試場景

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 檢查 adb 連接
check_adb_connection() {
    log_info "檢查 ADB 連接..."
    if ! adb devices | grep -q "device$"; then
        log_error "未找到已連接的 Android 設備"
        exit 1
    fi
    log_success "ADB 連接正常"
}

# 清空日誌
clear_logs() {
    log_info "清空設備日誌..."
    adb logcat -c
    log_success "日誌已清空"
}

# 收集日誌
collect_logs() {
    local output_file="$1"
    log_info "收集日誌到 $output_file..."
    adb logcat > "$output_file" &
    local logcat_pid=$!
    echo $logcat_pid > /tmp/logcat.pid
}

# 停止日誌收集
stop_collecting_logs() {
    if [ -f /tmp/logcat.pid ]; then
        kill $(cat /tmp/logcat.pid) 2>/dev/null || true
        rm /tmp/logcat.pid
    fi
}

# 測試 1: Foreground Service 通知
test_foreground_service() {
    log_info "========== 測試 1: Foreground Service 通知 =========="
    
    log_info "打開應用並進入 Relive 頁面..."
    adb shell am start -n com.jason123453021.bikeassistant/.MainActivity
    sleep 3
    
    log_info "檢查通知欄..."
    sleep 2
    
    log_info "查看日誌中的 RideTrackingService 消息..."
    adb logcat -d | grep -i "RideTrackingService" || log_warning "未找到 RideTrackingService 日誌"
    
    log_info "驗證通知是否顯示（請手動檢查屏幕）"
    read -p "通知是否正確顯示？(y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_success "Foreground Service 通知測試通過"
    else
        log_error "Foreground Service 通知測試失敗"
    fi
}

# 測試 2: WakeLock 功能
test_wakelock() {
    log_info "========== 測試 2: WakeLock 功能 =========="
    
    log_info "檢查 WakeLock 狀態..."
    adb shell "dumpsys power | grep -A 5 'Wake Locks'" || log_warning "無法獲取 WakeLock 狀態"
    
    log_info "查看 WakeLockManager 日誌..."
    adb logcat -d | grep -i "WakeLockManager" || log_warning "未找到 WakeLockManager 日誌"
    
    log_info "關閉屏幕 10 秒，然後打開屏幕..."
    adb shell input keyevent 26  # 關閉屏幕
    sleep 10
    adb shell input keyevent 26  # 打開屏幕
    
    log_info "驗證應用是否仍在運行（請手動檢查）"
    read -p "應用是否仍在運行？(y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_success "WakeLock 測試通過"
    else
        log_error "WakeLock 測試失敗"
    fi
}

# 測試 3: 屏幕關閉時的數據持續性
test_data_continuity() {
    log_info "========== 測試 3: 屏幕關閉時的數據持續性 =========="
    
    log_info "記錄當前的時間、距離、速度..."
    read -p "請輸入當前時間（格式: HH:MM:SS）: " current_time
    read -p "請輸入當前距離（km）: " current_distance
    read -p "請輸入當前速度（km/h）: " current_speed
    
    log_info "關閉屏幕 3 分鐘..."
    adb shell input keyevent 26
    sleep 180
    adb shell input keyevent 26
    
    log_info "檢查數據是否繼續更新..."
    read -p "時間是否增加？(y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_success "數據持續性測試通過"
    else
        log_error "數據持續性測試失敗"
    fi
}

# 測試 4: 電池最佳化檢查
test_battery_optimization() {
    log_info "========== 測試 4: 電池最佳化檢查 =========="
    
    log_info "檢查應用是否在電池最佳化限制名單中..."
    adb shell "dumpsys deviceidle | grep -i 'bike'" || log_warning "無法獲取電池最佳化狀態"
    
    log_info "查看 BatteryOptimization 日誌..."
    adb logcat -d | grep -i "BatteryOptimization" || log_warning "未找到 BatteryOptimization 日誌"
    
    log_info "驗證對話框是否顯示（請手動檢查）"
    read -p "對話框是否正確顯示？(y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_success "電池最佳化檢查測試通過"
    else
        log_error "電池最佳化檢查測試失敗"
    fi
}

# 測試 5: 進程優先級
test_process_priority() {
    log_info "========== 測試 5: 進程優先級 =========="
    
    log_info "查看進程優先級..."
    adb shell "ps -o PID,NAME,PRIORITY | grep bike" || log_warning "無法獲取進程優先級"
    
    log_info "查看 OOM 調整分數..."
    local pid=$(adb shell "pidof com.jason123453021.bikeassistant")
    if [ ! -z "$pid" ]; then
        adb shell "cat /proc/$pid/oom_score_adj" || log_warning "無法獲取 OOM 分數"
    fi
    
    log_success "進程優先級檢查完成"
}

# 收集性能數據
collect_performance_data() {
    log_info "========== 收集性能數據 =========="
    
    log_info "電池消耗..."
    adb shell "dumpsys batterystats | grep -A 20 'com.jason123453021.bikeassistant'" || log_warning "無法獲取電池統計"
    
    log_info "CPU 使用率..."
    adb shell "top -n 1 | grep bike" || log_warning "無法獲取 CPU 使用率"
    
    log_info "內存使用..."
    adb shell "dumpsys meminfo com.jason123453021.bikeassistant | head -20" || log_warning "無法獲取內存使用"
}

# 主函數
main() {
    log_info "========== Android 設備完整測試開始 =========="
    
    check_adb_connection
    clear_logs
    
    # 開始收集日誌
    local log_file="test_results_$(date +%Y%m%d_%H%M%S).log"
    collect_logs "$log_file"
    
    # 執行所有測試
    test_foreground_service
    test_wakelock
    test_data_continuity
    test_battery_optimization
    test_process_priority
    
    # 收集性能數據
    collect_performance_data
    
    # 停止日誌收集
    stop_collecting_logs
    
    log_success "========== 所有測試完成 =========="
    log_info "日誌已保存到: $log_file"
    
    # 顯示測試檢查清單
    log_info "========== 測試檢查清單 =========="
    echo "- [ ] Foreground Service 通知正確顯示"
    echo "- [ ] 通知無法被滑掉"
    echo "- [ ] 點擊通知返回應用"
    echo "- [ ] 屏幕關閉時 WakeLock 生效"
    echo "- [ ] 屏幕關閉時數據繼續更新"
    echo "- [ ] 電池最佳化提示正確顯示"
    echo "- [ ] 系統設定頁面跳轉正常"
    echo "- [ ] 進程優先級提高"
    echo "- [ ] 應用不被系統殺死"
    echo "- [ ] 電池消耗在可接受範圍內"
}

# 執行主函數
main
