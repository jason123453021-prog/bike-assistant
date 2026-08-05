/**
 * 補給提醒系統重構
 * 
 * 功能：
 * 1. 實時監聽卡路里和水分流失
 * 2. 達到閾值時觸發彈窗和語音提醒
 * 3. 支援自訂補給品和持續提醒
 */

export interface SupplyItem {
  id: string;
  name: string;
  type: 'calories' | 'water' | 'custom';
  threshold: number; // 觸發閾值
  unit: string; // 單位
  enabled: boolean;
  lastTriggeredAt?: number; // 上次觸發時間
}

export interface SupplyReminderState {
  caloriesBurned: number; // 已消耗卡路里
  waterLoss: number; // 已流失水分（ml）
  items: SupplyItem[];
  activeReminders: string[]; // 當前活躍的提醒 ID
  globalEnabled: boolean; // 全局開關
}

export interface SupplyReminderConfig {
  enableContinuousReminder: boolean; // 持續提醒
  reminderInterval: number; // 提醒間隔（秒）
  pauseOnDownhill: boolean; // 下坡時暫停
  downhillGradientThreshold: number; // 下坡判定閾值（%）
}

const DEFAULT_CONFIG: SupplyReminderConfig = {
  enableContinuousReminder: true,
  reminderInterval: 30, // 每 30 秒重複一次
  pauseOnDownhill: true,
  downhillGradientThreshold: -3, // 小於 -3% 視為下坡
};

/**
 * 創建默認的補給提醒狀態
 */
export function createDefaultSupplyReminderState(): SupplyReminderState {
  return {
    caloriesBurned: 0,
    waterLoss: 0,
    items: [
      {
        id: 'calories',
        name: '卡路里',
        type: 'calories',
        threshold: 500, // 每 500 kcal 提醒一次
        unit: 'kcal',
        enabled: true,
      },
      {
        id: 'water',
        name: '水分',
        type: 'water',
        threshold: 500, // 每 500 ml 提醒一次
        unit: 'ml',
        enabled: true,
      },
    ],
    activeReminders: [],
    globalEnabled: true,
  };
}

/**
 * 添加自訂補給品
 */
export function addCustomSupplyItem(
  state: SupplyReminderState,
  name: string,
  threshold: number,
  unit: string = 'unit'
): SupplyReminderState {
  const newItem: SupplyItem = {
    id: `custom_${Date.now()}`,
    name,
    type: 'custom',
    threshold,
    unit,
    enabled: true,
  };

  return {
    ...state,
    items: [...state.items, newItem],
  };
}

/**
 * 移除補給品
 */
export function removeSupplyItem(
  state: SupplyReminderState,
  itemId: string
): SupplyReminderState {
  return {
    ...state,
    items: state.items.filter((item) => item.id !== itemId),
    activeReminders: state.activeReminders.filter((id) => id !== itemId),
  };
}

/**
 * 更新補給品閾值
 */
export function updateSupplyItemThreshold(
  state: SupplyReminderState,
  itemId: string,
  threshold: number
): SupplyReminderState {
  return {
    ...state,
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, threshold } : item
    ),
  };
}

/**
 * 檢查是否應觸發補給提醒
 */
export function checkSupplyReminders(
  state: SupplyReminderState,
  currentCalories: number,
  currentWaterLoss: number,
  currentGradient: number = 0,
  config: Partial<SupplyReminderConfig> = {}
): { state: SupplyReminderState; triggeredItems: SupplyItem[] } {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const triggered: SupplyItem[] = [];
  let newState = { ...state };

  // 檢查是否在下坡（暫停提醒）
  const isDownhill = currentGradient < finalConfig.downhillGradientThreshold;
  if (isDownhill && finalConfig.pauseOnDownhill) {
    return { state: newState, triggeredItems: triggered };
  }

  const now = Date.now();

  for (const item of state.items) {
    if (!item.enabled || !state.globalEnabled) {
      continue;
    }

    let shouldTrigger = false;
    let currentValue = 0;

    if (item.type === 'calories') {
      currentValue = currentCalories;
      // 檢查是否達到閾值
      if (currentValue >= item.threshold) {
        shouldTrigger = true;
      }
    } else if (item.type === 'water') {
      currentValue = currentWaterLoss;
      if (currentValue >= item.threshold) {
        shouldTrigger = true;
      }
    } else if (item.type === 'custom') {
      // 自訂補給品：基於卡路里或水分
      // 簡化版：假設自訂補給品基於卡路里
      currentValue = currentCalories;
      if (currentValue >= item.threshold) {
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      // 檢查是否已在活躍提醒中
      if (!state.activeReminders.includes(item.id)) {
        triggered.push(item);
        newState.activeReminders.push(item.id);
        newState.items = newState.items.map((i) =>
          i.id === item.id ? { ...i, lastTriggeredAt: now } : i
        );
      }
    }
  }

  return { state: newState, triggeredItems: triggered };
}

/**
 * 重置補給品計數
 */
export function resetSupplyItem(
  state: SupplyReminderState,
  itemId: string
): SupplyReminderState {
  return {
    ...state,
    activeReminders: state.activeReminders.filter((id) => id !== itemId),
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, lastTriggeredAt: undefined } : item
    ),
  };
}

/**
 * 重置所有補給品計數
 */
export function resetAllSupplyItems(state: SupplyReminderState): SupplyReminderState {
  return {
    ...state,
    caloriesBurned: 0,
    waterLoss: 0,
    activeReminders: [],
    items: state.items.map((item) => ({ ...item, lastTriggeredAt: undefined })),
  };
}

/**
 * 更新已消耗卡路里
 */
export function updateCaloriesBurned(
  state: SupplyReminderState,
  calories: number
): SupplyReminderState {
  return {
    ...state,
    caloriesBurned: calories,
  };
}

/**
 * 更新水分流失
 */
export function updateWaterLoss(
  state: SupplyReminderState,
  waterLoss: number
): SupplyReminderState {
  return {
    ...state,
    waterLoss: waterLoss,
  };
}

/**
 * 切換全局開關
 */
export function toggleGlobalReminder(state: SupplyReminderState): SupplyReminderState {
  return {
    ...state,
    globalEnabled: !state.globalEnabled,
  };
}

/**
 * 切換單個補給品開關
 */
export function toggleSupplyItem(
  state: SupplyReminderState,
  itemId: string
): SupplyReminderState {
  return {
    ...state,
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, enabled: !item.enabled } : item
    ),
  };
}

/**
 * 獲取提醒文本
 */
export function getSupplyReminderText(item: SupplyItem): string {
  return `是時候補充 ${item.name} 了！`;
}

/**
 * 獲取提醒進度百分比
 */
export function getSupplyProgress(
  item: SupplyItem,
  currentValue: number
): number {
  return Math.min((currentValue / item.threshold) * 100, 100);
}

/**
 * 計算下次提醒時間
 */
export function getNextReminderTime(
  item: SupplyItem,
  currentValue: number
): number {
  if (currentValue >= item.threshold) {
    return 0; // 立即提醒
  }
  return item.threshold - currentValue;
}
