import { LocalStorageManager } from './local-storage-manager';

/**
 * 訂閱計劃類型
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  features: string[];
  description: string;
}

/**
 * 支付和訂閱管理器
 */
export class SubscriptionPaymentManager {
  /**
   * 可用的訂閱計劃
   */
  static readonly SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
    {
      id: 'free',
      name: '免費版',
      price: 0,
      currency: 'TWD',
      billingPeriod: 'monthly',
      features: [
        '基本騎乘記錄',
        '本地數據存儲',
        '基本統計分析',
      ],
      description: '適合休閒騎乘愛好者',
    },
    {
      id: 'pro_monthly',
      name: 'Pro 月訂',
      price: 99,
      currency: 'TWD',
      billingPeriod: 'monthly',
      features: [
        '所有免費版功能',
        '雲端數據同步',
        '高級分析和報告',
        '社區功能解鎖',
        '優先支持',
      ],
      description: '適合認真騎乘者',
    },
    {
      id: 'pro_yearly',
      name: 'Pro 年訂',
      price: 999,
      currency: 'TWD',
      billingPeriod: 'yearly',
      features: [
        '所有 Pro 月訂功能',
        '年度統計報告',
        '專屬社區徽章',
        '優惠折扣',
      ],
      description: '最划算的選擇',
    },
    {
      id: 'elite',
      name: 'Elite',
      price: 299,
      currency: 'TWD',
      billingPeriod: 'monthly',
      features: [
        '所有 Pro 功能',
        'AI 個性化教練',
        '隊伍管理工具',
        '賽事組織功能',
        '專屬客服',
      ],
      description: '適合專業騎乘者和隊伍',
    },
  ];

  /**
   * 支持的支付方式
   */
  static readonly PAYMENT_METHODS = [
    { id: 'credit_card', name: '信用卡', icon: '💳' },
    { id: 'debit_card', name: '簽帳卡', icon: '💳' },
    { id: 'apple_pay', name: 'Apple Pay', icon: '🍎' },
    { id: 'google_pay', name: 'Google Pay', icon: '🔵' },
    { id: 'line_pay', name: 'LINE Pay', icon: '💚' },
    { id: 'paypal', name: 'PayPal', icon: '🅿️' },
  ];

  /**
   * 獲取用戶訂閱狀態
   */
  static async getSubscriptionStatus() {
    const settings = await LocalStorageManager.getUserSettings();

    return {
      plan: settings?.subscription?.plan || 'free',
      status: settings?.subscription?.status || 'inactive',
      startDate: settings?.subscription?.startDate,
      endDate: settings?.subscription?.endDate,
      autoRenew: settings?.subscription?.autoRenew || false,
    };
  }

  /**
   * 升級訂閱
   */
  static async upgradeSubscription(planId: string, paymentMethod: string) {
    const plan = this.SUBSCRIPTION_PLANS.find((p) => p.id === planId);

    if (!plan) {
      throw new Error('訂閱計劃不存在');
    }

    // 模擬支付處理
    const paymentResult = await this.processPayment(plan, paymentMethod);

    if (!paymentResult.success) {
      throw new Error('支付失敗');
    }

    // 更新訂閱狀態
    const now = Date.now();
    const endDate = new Date(now);

    if (plan.billingPeriod === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    await LocalStorageManager.saveUserSettings({
      subscription: {
        plan: planId,
        status: 'active',
        startDate: now,
        endDate: endDate.getTime(),
        autoRenew: true,
        paymentMethod,
        transactionId: paymentResult.transactionId,
      },
    });

    return {
      success: true,
      message: `已升級至 ${plan.name}`,
      plan,
    };
  }

  /**
   * 取消訂閱
   */
  static async cancelSubscription() {
    await LocalStorageManager.saveUserSettings({
      subscription: {
        plan: 'free',
        status: 'cancelled',
        autoRenew: false,
      },
    });

    return { success: true, message: '訂閱已取消' };
  }

  /**
   * 檢查功能是否解鎖
   */
  static async isFeatureUnlocked(feature: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus();

    if (status.plan === 'free') {
      return ['basic_recording', 'local_storage', 'basic_stats'].includes(feature);
    }

    if (status.plan === 'pro_monthly' || status.plan === 'pro_yearly') {
      return ![
        'ai_coach',
        'team_management',
        'event_organization',
        'dedicated_support',
      ].includes(feature);
    }

    if (status.plan === 'elite') {
      return true;
    }

    return false;
  }

  /**
   * 獲取訂閱計劃詳情
   */
  static getPlanDetails(planId: string) {
    return this.SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  }

  /**
   * 獲取所有訂閱計劃
   */
  static getAllPlans() {
    return this.SUBSCRIPTION_PLANS;
  }

  /**
   * 模擬支付處理
   */
  private static async processPayment(plan: SubscriptionPlan, paymentMethod: string) {
    // 模擬支付延遲
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 模擬支付成功（90% 成功率）
    if (Math.random() < 0.9) {
      return {
        success: true,
        transactionId: `txn_${Date.now()}`,
        amount: plan.price,
        currency: plan.currency,
      };
    } else {
      return {
        success: false,
        error: '支付失敗，請重試',
      };
    }
  }

  /**
   * 獲取支付歷史
   */
  static async getPaymentHistory() {
    const settings = await LocalStorageManager.getUserSettings();

    return settings?.paymentHistory || [];
  }

  /**
   * 更新支付方式
   */
  static async updatePaymentMethod(paymentMethod: string) {
    const settings = await LocalStorageManager.getUserSettings();

    await LocalStorageManager.saveUserSettings({
      ...settings,
      defaultPaymentMethod: paymentMethod,
    });

    return { success: true, message: '支付方式已更新' };
  }

  /**
   * 獲取優惠券
   */
  static async getAvailableCoupons() {
    return [
      {
        id: 'NEW2024',
        name: '新用戶優惠',
        discount: 0.2,
        description: '首次訂閱享 20% 折扣',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'SUMMER50',
        name: '夏季優惠',
        discount: 0.15,
        description: '年訂享 15% 折扣',
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  /**
   * 應用優惠券
   */
  static async applyCoupon(couponId: string, planId: string) {
    const plan = this.SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    const coupons = await this.getAvailableCoupons();
    const coupon = coupons.find((c) => c.id === couponId);

    if (!plan || !coupon) {
      throw new Error('優惠券或計劃不存在');
    }

    const discountedPrice = plan.price * (1 - coupon.discount);

    return {
      originalPrice: plan.price,
      discount: plan.price - discountedPrice,
      finalPrice: discountedPrice,
      savingPercentage: coupon.discount * 100,
    };
  }
}
