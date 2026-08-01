/**
 * 雙態面板與動態數據自訂引擎
 * 管理導航頁面儀表板的收縮/展開狀態和數據項自訂
 */

export type DashboardDataField =
  | 'speed'
  | 'avgSpeed'
  | 'currentTime'
  | 'totalTime'
  | 'distance'
  | 'remainingDistance'
  | 'eta'
  | 'ascent'
  | 'calories'
  | 'water'
  | 'power'
  | 'heartRate'
  | 'cadence'
  | 'temperature'
  | 'humidity'
  | 'windSpeed'
  | 'windDirection'
  | 'airDensity'
  | 'rainProbability';

export interface DashboardConfig {
  // 收縮狀態顯示的字段（最多 6 個）
  collapsedFields: DashboardDataField[];
  
  // 展開狀態顯示的字段（最多 12 個）
  expandedFields: DashboardDataField[];
  
  // 精簡模式字段（最多 6 個）
  simplifiedFields: DashboardDataField[];
  
  // 是否啟用精簡模式
  simplifiedModeEnabled: boolean;
  
  // 精簡模式類型：'manual' 或 'auto'
  simplifiedModeType: 'manual' | 'auto';
  
  // 自動進入精簡模式的時間（秒）
  autoSimplifiedModeDelay: number;
  
  // 是否顯示次要數據卡片
  showSecondaryCards: boolean;
}

export interface DashboardState {
  isCollapsed: boolean;
  isSimplifiedMode: boolean;
  lastInteractionTime: number;
}

/**
 * 字段元數據
 */
export const FIELD_METADATA: Record<
  DashboardDataField,
  {
    label: string;
    unit: string;
    category: 'core' | 'performance' | 'environment' | 'health';
    icon: string;
  }
> = {
  speed: {
    label: '即時速度',
    unit: 'km/h',
    category: 'core',
    icon: 'speedometer',
  },
  avgSpeed: {
    label: '平均速度',
    unit: 'km/h',
    category: 'core',
    icon: 'speedometer-medium',
  },
  currentTime: {
    label: '當前時間',
    unit: '',
    category: 'core',
    icon: 'clock',
  },
  totalTime: {
    label: '騎乘時間',
    unit: 'h:m:s',
    category: 'core',
    icon: 'timer',
  },
  distance: {
    label: '總距離',
    unit: 'km',
    category: 'core',
    icon: 'map-distance',
  },
  remainingDistance: {
    label: '剩餘距離',
    unit: 'km',
    category: 'core',
    icon: 'map-distance-outline',
  },
  eta: {
    label: '預估到達',
    unit: 'h:m',
    category: 'core',
    icon: 'clock-alert',
  },
  ascent: {
    label: '總爬升',
    unit: 'm',
    category: 'performance',
    icon: 'mountain',
  },
  calories: {
    label: '卡路里',
    unit: 'kcal',
    category: 'performance',
    icon: 'fire',
  },
  water: {
    label: '水分流失',
    unit: 'ml',
    category: 'performance',
    icon: 'water',
  },
  power: {
    label: '功率',
    unit: 'W',
    category: 'performance',
    icon: 'lightning-bolt',
  },
  heartRate: {
    label: '心率',
    unit: 'bpm',
    category: 'health',
    icon: 'heart',
  },
  cadence: {
    label: '踏頻',
    unit: 'rpm',
    category: 'performance',
    icon: 'sync',
  },
  temperature: {
    label: '溫度',
    unit: '°C',
    category: 'environment',
    icon: 'thermometer',
  },
  humidity: {
    label: '濕度',
    unit: '%',
    category: 'environment',
    icon: 'water-percent',
  },
  windSpeed: {
    label: '風速',
    unit: 'km/h',
    category: 'environment',
    icon: 'wind-power',
  },
  windDirection: {
    label: '風向',
    unit: '°',
    category: 'environment',
    icon: 'compass',
  },
  airDensity: {
    label: '空氣密度',
    unit: 'kg/m³',
    category: 'environment',
    icon: 'air-filter',
  },
  rainProbability: {
    label: '降雨機率',
    unit: '%',
    category: 'environment',
    icon: 'cloud-rain',
  },
};

/**
 * 儀表板配置管理器
 */
export class DashboardConfigManager {
  private config: DashboardConfig;
  private state: DashboardState;

  constructor(initialConfig?: Partial<DashboardConfig>) {
    this.config = {
      // 預設收縮狀態：速度、距離、時間、爬升、卡路里、水分
      collapsedFields: ['speed', 'distance', 'totalTime', 'ascent', 'calories', 'water'],
      
      // 預設展開狀態：包含所有核心字段和部分性能字段
      expandedFields: [
        'speed',
        'avgSpeed',
        'distance',
        'remainingDistance',
        'totalTime',
        'eta',
        'ascent',
        'calories',
        'water',
        'power',
        'heartRate',
        'cadence',
      ],
      
      // 預設精簡模式字段
      simplifiedFields: ['speed', 'distance', 'totalTime', 'eta', 'currentTime', 'remainingDistance'],
      
      simplifiedModeEnabled: false,
      simplifiedModeType: 'manual',
      autoSimplifiedModeDelay: 30, // 30 秒
      showSecondaryCards: true,
      
      ...initialConfig,
    };

    this.state = {
      isCollapsed: true,
      isSimplifiedMode: false,
      lastInteractionTime: Date.now(),
    };
  }

  /**
   * 切換收縮/展開狀態
   */
  toggleCollapsed(): void {
    this.state.isCollapsed = !this.state.isCollapsed;
    this.state.lastInteractionTime = Date.now();
  }

  /**
   * 設置收縮狀態
   */
  setCollapsed(collapsed: boolean): void {
    this.state.isCollapsed = collapsed;
    this.state.lastInteractionTime = Date.now();
  }

  /**
   * 進入/退出精簡模式
   */
  setSimplifiedMode(enabled: boolean): void {
    this.state.isSimplifiedMode = enabled;
    this.state.lastInteractionTime = Date.now();
  }

  /**
   * 獲取當前應顯示的字段
   */
  getCurrentFields(): DashboardDataField[] {
    if (this.state.isSimplifiedMode) {
      return this.config.simplifiedFields;
    }
    return this.state.isCollapsed ? this.config.collapsedFields : this.config.expandedFields;
  }

  /**
   * 設置收縮狀態字段
   */
  setCollapsedFields(fields: DashboardDataField[]): void {
    // 限制最多 6 個字段
    this.config.collapsedFields = fields.slice(0, 6);
  }

  /**
   * 設置展開狀態字段
   */
  setExpandedFields(fields: DashboardDataField[]): void {
    // 限制最多 12 個字段
    this.config.expandedFields = fields.slice(0, 12);
  }

  /**
   * 設置精簡模式字段
   */
  setSimplifiedFields(fields: DashboardDataField[]): void {
    // 限制最多 6 個字段
    this.config.simplifiedFields = fields.slice(0, 6);
  }

  /**
   * 添加字段到收縮狀態
   */
  addCollapsedField(field: DashboardDataField): void {
    if (
      !this.config.collapsedFields.includes(field) &&
      this.config.collapsedFields.length < 6
    ) {
      this.config.collapsedFields.push(field);
    }
  }

  /**
   * 從收縮狀態移除字段
   */
  removeCollapsedField(field: DashboardDataField): void {
    this.config.collapsedFields = this.config.collapsedFields.filter(f => f !== field);
  }

  /**
   * 添加字段到展開狀態
   */
  addExpandedField(field: DashboardDataField): void {
    if (
      !this.config.expandedFields.includes(field) &&
      this.config.expandedFields.length < 12
    ) {
      this.config.expandedFields.push(field);
    }
  }

  /**
   * 從展開狀態移除字段
   */
  removeExpandedField(field: DashboardDataField): void {
    this.config.expandedFields = this.config.expandedFields.filter(f => f !== field);
  }

  /**
   * 獲取配置
   */
  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  /**
   * 獲取狀態
   */
  getState(): DashboardState {
    return { ...this.state };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 記錄用戶交互
   */
  recordInteraction(): void {
    this.state.lastInteractionTime = Date.now();
  }

  /**
   * 獲取無操作時間（秒）
   */
  getIdleTime(): number {
    return (Date.now() - this.state.lastInteractionTime) / 1000;
  }

  /**
   * 檢查是否應自動進入精簡模式
   */
  shouldAutoEnterSimplifiedMode(): boolean {
    if (!this.config.simplifiedModeEnabled || this.config.simplifiedModeType !== 'auto') {
      return false;
    }
    return this.getIdleTime() >= this.config.autoSimplifiedModeDelay;
  }

  /**
   * 重置為預設配置
   */
  resetToDefaults(): void {
    this.config = {
      collapsedFields: ['speed', 'distance', 'totalTime', 'ascent', 'calories', 'water'],
      expandedFields: [
        'speed',
        'avgSpeed',
        'distance',
        'remainingDistance',
        'totalTime',
        'eta',
        'ascent',
        'calories',
        'water',
        'power',
        'heartRate',
        'cadence',
      ],
      simplifiedFields: ['speed', 'distance', 'totalTime', 'eta', 'currentTime', 'remainingDistance'],
      simplifiedModeEnabled: false,
      simplifiedModeType: 'manual',
      autoSimplifiedModeDelay: 30,
      showSecondaryCards: true,
    };
  }

  /**
   * 驗證配置
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.collapsedFields.length > 6) {
      errors.push('Collapsed fields cannot exceed 6');
    }

    if (this.config.expandedFields.length > 12) {
      errors.push('Expanded fields cannot exceed 12');
    }

    if (this.config.simplifiedFields.length > 6) {
      errors.push('Simplified fields cannot exceed 6');
    }

    // 檢查字段是否有效
    const validFields = Object.keys(FIELD_METADATA) as DashboardDataField[];
    for (const field of this.config.collapsedFields) {
      if (!validFields.includes(field)) {
        errors.push(`Invalid field: ${field}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * 全局儀表板配置管理器實例
 */
let globalDashboardManager: DashboardConfigManager | null = null;

/**
 * 獲取全局儀表板配置管理器
 */
export function getDashboardConfigManager(
  initialConfig?: Partial<DashboardConfig>
): DashboardConfigManager {
  if (!globalDashboardManager) {
    globalDashboardManager = new DashboardConfigManager(initialConfig);
  }
  return globalDashboardManager;
}
