/**
 * 分析和追蹤管理器
 * 追蹤用戶行為和應用事件
 */

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: number;
}

export interface UserAnalytics {
  userId: string;
  sessionId: string;
  startTime: number;
  events: AnalyticsEvent[];
}

export class AnalyticsTrackingManager {
  private static events: AnalyticsEvent[] = [];
  private static sessionId: string = `session_${Date.now()}`;
  private static userId: string = 'anonymous';

  /**
   * 初始化分析
   */
  static initialize(userId: string) {
    this.userId = userId;
    this.sessionId = `session_${Date.now()}`;
    this.events = [];
    console.log('[Analytics] Initialized for user:', userId);
  }

  /**
   * 追蹤事件
   */
  static trackEvent(name: string, properties?: Record<string, any>) {
    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: Date.now(),
    };
    this.events.push(event);
    console.log('[Analytics] Event tracked:', name, properties);
  }

  /**
   * 追蹤頁面訪問
   */
  static trackPageView(pageName: string) {
    this.trackEvent('page_view', { page: pageName });
  }

  /**
   * 追蹤騎乘開始
   */
  static trackRideStart(rideId: string) {
    this.trackEvent('ride_start', { rideId });
  }

  /**
   * 追蹤騎乘結束
   */
  static trackRideEnd(rideId: string, distance: number, duration: number) {
    this.trackEvent('ride_end', { rideId, distance, duration });
  }

  /**
   * 追蹤功能使用
   */
  static trackFeatureUsage(featureName: string, metadata?: Record<string, any>) {
    this.trackEvent('feature_usage', { feature: featureName, ...metadata });
  }

  /**
   * 追蹤錯誤
   */
  static trackError(errorName: string, errorMessage: string, stackTrace?: string) {
    this.trackEvent('error', { name: errorName, message: errorMessage, stackTrace });
  }

  /**
   * 追蹤用戶交互
   */
  static trackUserInteraction(action: string, target: string) {
    this.trackEvent('user_interaction', { action, target });
  }

  /**
   * 追蹤應用內購買
   */
  static trackPurchase(productId: string, price: number, currency: string) {
    this.trackEvent('purchase', { productId, price, currency });
  }

  /**
   * 追蹤訂閱
   */
  static trackSubscription(planId: string, price: number, duration: string) {
    this.trackEvent('subscription', { planId, price, duration });
  }

  /**
   * 獲取所有事件
   */
  static getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * 獲取會話分析
   */
  static getSessionAnalytics(): UserAnalytics {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      startTime: Date.now(),
      events: this.events,
    };
  }

  /**
   * 清空事件
   */
  static clearEvents() {
    this.events = [];
  }

  /**
   * 發送事件到後端
   */
  static async sendEventsToBackend(endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          sessionId: this.sessionId,
          events: this.events,
        }),
      });

      if (response.ok) {
        console.log('[Analytics] Events sent successfully');
        this.clearEvents();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Analytics] Failed to send events:', error);
      return false;
    }
  }

  /**
   * 生成分析報告
   */
  static generateReport() {
    const eventCounts: Record<string, number> = {};
    this.events.forEach((event) => {
      eventCounts[event.name] = (eventCounts[event.name] || 0) + 1;
    });

    return {
      sessionId: this.sessionId,
      userId: this.userId,
      totalEvents: this.events.length,
      eventCounts,
      startTime: this.events[0]?.timestamp || Date.now(),
      endTime: this.events[this.events.length - 1]?.timestamp || Date.now(),
    };
  }
}
