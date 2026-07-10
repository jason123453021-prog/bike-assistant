/**
 * 地圖組件佈局管理器
 * 
 * 功能：
 * - 管理地圖上各個組件的位置
 * - 優先保護地圖導航畫面
 * - 自動調整組件位置以減少遮擋
 */

export interface ComponentPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  zIndex: number;
}

export interface MapLayoutConfig {
  screenWidth: number;
  screenHeight: number;
  tabBarHeight: number;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * 計算組件位置，優先保護地圖導航畫面
 */
export class MapComponentsLayout {
  private config: MapLayoutConfig;
  private usedAreas: Array<{ x: number; y: number; width: number; height: number }> = [];

  constructor(config: MapLayoutConfig) {
    this.config = config;
  }

  /**
   * 獲取 GPS 追蹤指示器位置
   * 位置：左上角（優先級最高）
   */
  getGPSTrackerPosition(): ComponentPosition {
    return {
      top: this.config.safeAreaInsets.top + 16,
      left: 16,
      zIndex: 100,
    };
  }

  /**
   * 獲取地圖縮放控制按鈕位置
   * 位置：右上角
   */
  getZoomControlsPosition(): ComponentPosition {
    return {
      top: this.config.safeAreaInsets.top + 16,
      right: 16,
      zIndex: 100,
    };
  }

  /**
   * 獲取導航欄位置
   * 位置：頂部中央（優先級高）
   */
  getNavigationBarPosition(): ComponentPosition {
    return {
      top: this.config.safeAreaInsets.top + 8,
      left: 16,
      right: 16,
      zIndex: 90,
    };
  }

  /**
   * 獲取路線預覽位置
   * 位置：底部（在標籤欄上方）
   */
  getRoutePreviewPosition(): ComponentPosition {
    return {
      bottom: this.config.tabBarHeight + this.config.safeAreaInsets.bottom + 16,
      left: 16,
      right: 16,
      zIndex: 80,
    };
  }

  /**
   * 獲取地址搜尋面板位置
   * 位置：中上方（可收縮）
   */
  getRouteSearchPanelPosition(): ComponentPosition {
    return {
      top: this.config.safeAreaInsets.top + 80,
      left: 16,
      right: 16,
      zIndex: 85,
    };
  }

  /**
   * 檢查組件是否會遮擋地圖核心區域
   * 核心區域：螢幕中央 50% 的區域
   */
  isBlockingCoreMapArea(
    componentTop: number,
    componentLeft: number,
    componentWidth: number,
    componentHeight: number
  ): boolean {
    const coreAreaLeft = this.config.screenWidth * 0.25;
    const coreAreaTop = this.config.screenHeight * 0.25;
    const coreAreaRight = this.config.screenWidth * 0.75;
    const coreAreaBottom = this.config.screenHeight * 0.75;

    const componentRight = componentLeft + componentWidth;
    const componentBottom = componentTop + componentHeight;

    // 檢查是否與核心區域重疊
    return !(
      componentRight < coreAreaLeft ||
      componentLeft > coreAreaRight ||
      componentBottom < coreAreaTop ||
      componentTop > coreAreaBottom
    );
  }

  /**
   * 獲取推薦的組件可見性配置
   * 基於當前導航狀態
   */
  getComponentVisibilityConfig(isNavigating: boolean, showSearchPanel: boolean) {
    return {
      gpsTracker: {
        visible: true,
        opacity: 0.9,
      },
      zoomControls: {
        visible: true,
        opacity: 0.9,
      },
      navigationBar: {
        visible: isNavigating,
        opacity: isNavigating ? 1 : 0,
      },
      routePreview: {
        visible: isNavigating,
        opacity: isNavigating ? 0.85 : 0,
      },
      routeSearchPanel: {
        visible: showSearchPanel,
        opacity: showSearchPanel ? 1 : 0,
      },
    };
  }

  /**
   * 計算最優的組件堆疊順序
   */
  getComponentZIndexOrder() {
    return {
      background: 1,
      map: 10,
      mapControls: 100,
      navigationBar: 90,
      routePreview: 80,
      routeSearchPanel: 85,
      modals: 200,
    };
  }

  /**
   * 重置使用的區域
   */
  resetUsedAreas() {
    this.usedAreas = [];
  }

  /**
   * 記錄已使用的區域
   */
  markAreaAsUsed(x: number, y: number, width: number, height: number) {
    this.usedAreas.push({ x, y, width, height });
  }

  /**
   * 獲取所有已使用的區域
   */
  getUsedAreas() {
    return this.usedAreas;
  }
}

/**
 * 創建默認的佈局配置
 */
export function createDefaultMapLayout(
  screenWidth: number,
  screenHeight: number,
  tabBarHeight: number,
  safeAreaInsets: { top: number; bottom: number; left: number; right: number }
): MapComponentsLayout {
  return new MapComponentsLayout({
    screenWidth,
    screenHeight,
    tabBarHeight,
    safeAreaInsets,
  });
}
