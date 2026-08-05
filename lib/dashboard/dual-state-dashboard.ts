/**
 * 雙態儀表板面板管理
 * 
 * 功能：
 * 1. 管理收縮狀態和展開狀態的數據字段
 * 2. 支援動態字段自訂
 * 3. 提供面板高度計算和交互邏輯
 */

export type DashboardField =
  | 'speed'
  | 'avg_speed'
  | 'time'
  | 'total_time'
  | 'distance'
  | 'remaining_distance'
  | 'eta'
  | 'ascent'
  | 'calories'
  | 'water_loss'
  | 'current_time'
  | 'gradient'
  | 'power'
  | 'heart_rate'
  | 'cadence';

export interface DashboardFieldConfig {
  field: DashboardField;
  label: string;
  unit: string;
  format: (value: number) => string;
}

export interface DashboardState {
  collapsed: boolean;
  collapsedFields: DashboardField[];
  expandedFields: DashboardField[];
}

const FIELD_CONFIGS: Record<DashboardField, DashboardFieldConfig> = {
  speed: {
    field: 'speed',
    label: '即時速度',
    unit: 'km/h',
    format: (v) => v.toFixed(1),
  },
  avg_speed: {
    field: 'avg_speed',
    label: '均速',
    unit: 'km/h',
    format: (v) => v.toFixed(1),
  },
  time: {
    field: 'time',
    label: '騎乘時間',
    unit: '',
    format: (v) => formatTime(v),
  },
  total_time: {
    field: 'total_time',
    label: '總時間',
    unit: '',
    format: (v) => formatTime(v),
  },
  distance: {
    field: 'distance',
    label: '距離',
    unit: 'km',
    format: (v) => v.toFixed(2),
  },
  remaining_distance: {
    field: 'remaining_distance',
    label: '剩餘距離',
    unit: 'km',
    format: (v) => v.toFixed(2),
  },
  eta: {
    field: 'eta',
    label: '預估到達',
    unit: '',
    format: (v) => formatTime(v),
  },
  ascent: {
    field: 'ascent',
    label: '總爬升',
    unit: 'm',
    format: (v) => Math.round(v).toString(),
  },
  calories: {
    field: 'calories',
    label: '卡路里',
    unit: 'kcal',
    format: (v) => Math.round(v).toString(),
  },
  water_loss: {
    field: 'water_loss',
    label: '水分流失',
    unit: 'ml',
    format: (v) => Math.round(v).toString(),
  },
  current_time: {
    field: 'current_time',
    label: '當前時間',
    unit: '',
    format: (v) => formatTimeOfDay(v),
  },
  gradient: {
    field: 'gradient',
    label: '坡度',
    unit: '%',
    format: (v) => v.toFixed(1),
  },
  power: {
    field: 'power',
    label: '功率',
    unit: 'W',
    format: (v) => Math.round(v).toString(),
  },
  heart_rate: {
    field: 'heart_rate',
    label: '心率',
    unit: 'bpm',
    format: (v) => Math.round(v).toString(),
  },
  cadence: {
    field: 'cadence',
    label: '踏頻',
    unit: 'rpm',
    format: (v) => Math.round(v).toString(),
  },
};

const DEFAULT_COLLAPSED_FIELDS: DashboardField[] = ['speed', 'distance', 'time'];
const DEFAULT_EXPANDED_FIELDS: DashboardField[] = [
  'speed',
  'avg_speed',
  'distance',
  'time',
  'ascent',
  'calories',
];

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatTimeOfDay(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function createDefaultDashboardState(): DashboardState {
  return {
    collapsed: true,
    collapsedFields: DEFAULT_COLLAPSED_FIELDS,
    expandedFields: DEFAULT_EXPANDED_FIELDS,
  };
}

export function validateFields(fields: DashboardField[], maxCount: number): boolean {
  if (fields.length > maxCount) {
    return false;
  }
  return fields.every((field) => field in FIELD_CONFIGS);
}

export function updateCollapsedFields(
  state: DashboardState,
  fields: DashboardField[]
): DashboardState {
  if (!validateFields(fields, 3)) {
    console.warn('[Dashboard] Invalid collapsed fields');
    return state;
  }

  return {
    ...state,
    collapsedFields: fields,
  };
}

export function updateExpandedFields(
  state: DashboardState,
  fields: DashboardField[]
): DashboardState {
  if (!validateFields(fields, 6)) {
    console.warn('[Dashboard] Invalid expanded fields');
    return state;
  }

  return {
    ...state,
    expandedFields: fields,
  };
}

export function toggleDashboardState(state: DashboardState): DashboardState {
  return {
    ...state,
    collapsed: !state.collapsed,
  };
}

export function getCurrentFields(state: DashboardState): DashboardField[] {
  return state.collapsed ? state.collapsedFields : state.expandedFields;
}

export function getFieldConfig(field: DashboardField): DashboardFieldConfig {
  return FIELD_CONFIGS[field];
}

export function calculateDashboardHeight(
  state: DashboardState,
  screenHeight: number
): number {
  if (state.collapsed) {
    return screenHeight / 5;
  } else {
    return screenHeight / 3;
  }
}

export function getAvailableFields(): DashboardField[] {
  return Object.keys(FIELD_CONFIGS) as DashboardField[];
}

export function getFieldLabel(field: DashboardField): string {
  return FIELD_CONFIGS[field]?.label || field;
}

export function formatFieldValue(field: DashboardField, value: number): string {
  const config = FIELD_CONFIGS[field];
  if (!config) {
    return value.toString();
  }
  return config.format(value);
}

export function getFieldUnit(field: DashboardField): string {
  return FIELD_CONFIGS[field]?.unit || '';
}
