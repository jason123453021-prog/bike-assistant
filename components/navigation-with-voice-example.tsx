import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ScreenContainer } from './screen-container';
import { useVoiceTurnNotification } from './voice-turn-notification-provider';
import { TurnByTurnNavigationManager } from '@/lib/turn-by-turn-navigation';
import { cn } from '@/lib/utils';

/**
 * 轉向導航語音提示集成示例
 * 展示如何在導航中集成語音提示功能
 */
export function NavigationWithVoiceExample() {
  const { checkAndPlayTurnNotification, getConfig, isSpeaking } = useVoiceTurnNotification();
  const [navigationState, setNavigationState] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(0);

  // 模擬導航
  const startSimulation = () => {
    setIsNavigating(true);

    // 設置導航指令
    const navigator = new TurnByTurnNavigationManager();
    const instructions = [
      {
        id: '1',
        type: 'start' as const,
        direction: 'straight' as const,
        angle: 0,
        distance: 1000,
        instruction: '開始騎乘',
        coordinates: [25.0, 121.5] as [number, number],
      },
      {
        id: '2',
        type: 'turn-left' as const,
        direction: 'left' as const,
        angle: 90,
        distance: 500,
        street: '中山路',
        instruction: '左轉進入中山路',
        coordinates: [25.01, 121.51] as [number, number],
      },
      {
        id: '3',
        type: 'turn-right' as const,
        direction: 'right' as const,
        angle: -90,
        distance: 300,
        street: '民生路',
        instruction: '右轉進入民生路',
        coordinates: [25.02, 121.52] as [number, number],
      },
    ];

    const polyline: [number, number][] = [
      [25.0, 121.5],
      [25.005, 121.505],
      [25.01, 121.51],
      [25.015, 121.515],
      [25.02, 121.52],
    ];

    navigator.setInstructions(instructions, polyline);
    setNavigationState({
      navigator,
      instructions,
      currentInstructionIndex: 0,
    });

    // 模擬距離變化
    simulateDistanceChange(navigator, instructions);
  };

  // 模擬距離變化
  const simulateDistanceChange = (navigator: TurnByTurnNavigationManager, instructions: any[]) => {
    let distance = 1000;
    const interval = setInterval(async () => {
      distance -= 50; // 每次減少 50 米

      setCurrentDistance(distance);

      if (distance <= 0) {
        clearInterval(interval);
        setIsNavigating(false);
        return;
      }

      // 獲取當前指令
      const currentInstruction = instructions[navigationState?.currentInstructionIndex || 0];
      if (currentInstruction) {
        // 檢查並播放語音提示
        await checkAndPlayTurnNotification(
          distance,
          currentInstruction.type,
          currentInstruction.instruction,
          generateVoiceText(currentInstruction, distance)
        );

        // 當距離小於 50 米時，移動到下一個指令
        if (distance < 50 && navigationState?.currentInstructionIndex < instructions.length - 1) {
          setNavigationState((prev: any) => ({
            ...prev,
            currentInstructionIndex: prev.currentInstructionIndex + 1,
          }));
          distance = 1000;
        }
      }
    }, 2000); // 每 2 秒更新一次
  };

  // 生成語音文本
  const generateVoiceText = (instruction: any, distance: number): string => {
    const config = getConfig();
    const distanceText = distance > 1000 ? `${(distance / 1000).toFixed(1)} 公里` : `${distance} 公尺`;

    if (distance <= 50) {
      // 立即轉彎提示
      if (instruction.type === 'turn-left') {
        return `立即左轉${instruction.street ? '進入' + instruction.street : ''}`;
      } else if (instruction.type === 'turn-right') {
        return `立即右轉${instruction.street ? '進入' + instruction.street : ''}`;
      }
      return `立即${instruction.instruction}`;
    } else {
      // 接近轉彎提示
      if (instruction.type === 'turn-left') {
        return `${distanceText}後左轉${instruction.street ? '進入' + instruction.street : ''}`;
      } else if (instruction.type === 'turn-right') {
        return `${distanceText}後右轉${instruction.street ? '進入' + instruction.street : ''}`;
      }
      return `${distanceText}後${instruction.instruction}`;
    }
  };

  const stopSimulation = () => {
    setIsNavigating(false);
    setCurrentDistance(0);
    setNavigationState(null);
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="gap-4">
        {/* 標題 */}
        <View className="gap-2">
          <Text className="text-2xl font-bold text-foreground">轉向導航語音提示</Text>
          <Text className="text-sm text-muted">
            演示接近轉彎時自動播放語音提醒的功能
          </Text>
        </View>

        {/* 當前狀態 */}
        <View className="bg-surface rounded-lg p-4 gap-3">
          <Text className="text-base font-semibold text-foreground">當前狀態</Text>

          <View className="gap-2">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted">導航狀態</Text>
              <Text className={cn(
                'text-sm font-semibold',
                isNavigating ? 'text-success' : 'text-muted'
              )}>
                {isNavigating ? '進行中' : '已停止'}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted">距離轉彎</Text>
              <Text className="text-sm font-semibold text-foreground">
                {currentDistance > 0 ? `${currentDistance} 公尺` : '未開始'}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted">語音播放中</Text>
              <Text className={cn(
                'text-sm font-semibold',
                isSpeaking() ? 'text-success' : 'text-muted'
              )}>
                {isSpeaking() ? '是' : '否'}
              </Text>
            </View>
          </View>
        </View>

        {/* 控制按鈕 */}
        <View className="gap-2">
          <Pressable
            onPress={startSimulation}
            disabled={isNavigating}
            className={cn(
              'py-3 px-4 rounded-lg',
              isNavigating ? 'bg-muted opacity-50' : 'bg-primary'
            )}
            style={({ pressed }) => [pressed && { opacity: 0.8 }]}
          >
            <Text className="text-center font-semibold text-background">
              {isNavigating ? '導航進行中...' : '開始模擬導航'}
            </Text>
          </Pressable>

          <Pressable
            onPress={stopSimulation}
            disabled={!isNavigating}
            className={cn(
              'py-3 px-4 rounded-lg',
              !isNavigating ? 'bg-muted opacity-50' : 'bg-error'
            )}
            style={({ pressed }) => [pressed && { opacity: 0.8 }]}
          >
            <Text className="text-center font-semibold text-background">
              停止導航
            </Text>
          </Pressable>
        </View>

        {/* 語音提示說明 */}
        <View className="bg-blue-50 rounded-lg p-4 gap-2 border border-blue-200">
          <Text className="text-sm font-semibold text-blue-900">📢 語音提示說明</Text>
          <View className="gap-1">
            <Text className="text-xs text-blue-800">
              • 接近轉彎（300 米）：播放「X 公尺後左/右轉」
            </Text>
            <Text className="text-xs text-blue-800">
              • 立即轉彎（50 米）：播放「立即左/右轉」
            </Text>
            <Text className="text-xs text-blue-800">
              • 支援自定義語速、音量、音調
            </Text>
            <Text className="text-xs text-blue-800">
              • 支援靜音模式和重複播放
            </Text>
          </View>
        </View>

        {/* 使用說明 */}
        <View className="bg-amber-50 rounded-lg p-4 gap-2 border border-amber-200">
          <Text className="text-sm font-semibold text-amber-900">💡 使用說明</Text>
          <View className="gap-1">
            <Text className="text-xs text-amber-800">
              1. 點擊「開始模擬導航」開始演示
            </Text>
            <Text className="text-xs text-amber-800">
              2. 系統會模擬騎乘接近轉彎點
            </Text>
            <Text className="text-xs text-amber-800">
              3. 當距離減少時，自動播放語音提示
            </Text>
            <Text className="text-xs text-amber-800">
              4. 在設置中調整語音速率、音量等參數
            </Text>
          </View>
        </View>

        {/* 集成代碼示例 */}
        <View className="bg-surface rounded-lg p-4 gap-2">
          <Text className="text-sm font-semibold text-foreground">集成代碼示例</Text>
          <View className="bg-background rounded p-2">
            <Text className="text-xs font-mono text-muted">
              {`// 在導航循環中調用\nawait checkAndPlayTurnNotification(\n  distance,\n  turnType,\n  instruction,\n  voiceText\n);`}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
