/**
 * 路線難度分類
 */
export type RouteDifficulty = 'easy' | 'moderate' | 'hard' | 'expert';

/**
 * 難度分級標準
 */
export interface DifficultyStandard {
  difficulty: RouteDifficulty;
  label: string;
  color: string;
  icon: string;
  minDistance: number;
  maxDistance: number;
  minElevation: number;
  maxElevation: number;
  minGradient: number;
  maxGradient: number;
  description: string;
}

/**
 * 路線難度分類器
 */
class RouteDifficultyClassifier {
  private static instance: RouteDifficultyClassifier;

  private readonly DIFFICULTY_STANDARDS: DifficultyStandard[] = [
    {
      difficulty: 'easy',
      label: '簡單',
      color: '#22C55E',
      icon: '🟢',
      minDistance: 0,
      maxDistance: 15,
      minElevation: 0,
      maxElevation: 200,
      minGradient: 0,
      maxGradient: 2,
      description: '適合初學者，路線平坦，距離短',
    },
    {
      difficulty: 'moderate',
      label: '中等',
      color: '#3B82F6',
      icon: '🔵',
      minDistance: 10,
      maxDistance: 50,
      minElevation: 100,
      maxElevation: 500,
      minGradient: 1,
      maxGradient: 4,
      description: '適合有經驗的騎手，有適度的爬升',
    },
    {
      difficulty: 'hard',
      label: '困難',
      color: '#F59E0B',
      icon: '🟠',
      minDistance: 30,
      maxDistance: 100,
      minElevation: 300,
      maxElevation: 1000,
      minGradient: 3,
      maxGradient: 6,
      description: '適合進階騎手，有明顯的爬升和挑戰',
    },
    {
      difficulty: 'expert',
      label: '專家',
      color: '#EF4444',
      icon: '🔴',
      minDistance: 50,
      maxDistance: Infinity,
      minElevation: 500,
      maxElevation: Infinity,
      minGradient: 5,
      maxGradient: Infinity,
      description: '適合專業騎手，極具挑戰性',
    },
  ];

  private constructor() {}

  static getInstance(): RouteDifficultyClassifier {
    if (!RouteDifficultyClassifier.instance) {
      RouteDifficultyClassifier.instance = new RouteDifficultyClassifier();
    }
    return RouteDifficultyClassifier.instance;
  }

  /**
   * 根據路線數據分類難度
   */
  classifyDifficulty(
    distance: number, // 公里
    elevationGain: number, // 公尺
    trackPoints: Array<{ lat: number; lon: number; altitude?: number }>
  ): RouteDifficulty {
    // 計算平均坡度
    const averageGradient = (elevationGain / distance) * 100;

    // 計算難度分數
    const difficultyScore = this.calculateDifficultyScore(
      distance,
      elevationGain,
      averageGradient
    );

    // 根據分數判斷難度
    if (difficultyScore < 20) {
      return 'easy';
    } else if (difficultyScore < 50) {
      return 'moderate';
    } else if (difficultyScore < 80) {
      return 'hard';
    } else {
      return 'expert';
    }
  }

  /**
   * 計算難度分數（0-100）
   */
  private calculateDifficultyScore(
    distance: number,
    elevationGain: number,
    averageGradient: number
  ): number {
    // 距離因子（0-30分）
    let distanceScore = Math.min((distance / 100) * 30, 30);

    // 爬升因子（0-40分）
    let elevationScore = Math.min((elevationGain / 1000) * 40, 40);

    // 坡度因子（0-30分）
    let gradientScore = Math.min((averageGradient / 10) * 30, 30);

    return distanceScore + elevationScore + gradientScore;
  }

  /**
   * 獲取難度標準
   */
  getDifficultyStandard(difficulty: RouteDifficulty): DifficultyStandard {
    const standard = this.DIFFICULTY_STANDARDS.find(
      (s) => s.difficulty === difficulty
    );
    return standard || this.DIFFICULTY_STANDARDS[0];
  }

  /**
   * 獲取所有難度標準
   */
  getAllDifficultyStandards(): DifficultyStandard[] {
    return this.DIFFICULTY_STANDARDS;
  }

  /**
   * 獲取難度標籤
   */
  getDifficultyLabel(difficulty: RouteDifficulty): string {
    const standard = this.getDifficultyStandard(difficulty);
    return standard.label;
  }

  /**
   * 獲取難度顏色
   */
  getDifficultyColor(difficulty: RouteDifficulty): string {
    const standard = this.getDifficultyStandard(difficulty);
    return standard.color;
  }

  /**
   * 獲取難度圖標
   */
  getDifficultyIcon(difficulty: RouteDifficulty): string {
    const standard = this.getDifficultyStandard(difficulty);
    return standard.icon;
  }

  /**
   * 獲取難度描述
   */
  getDifficultyDescription(difficulty: RouteDifficulty): string {
    const standard = this.getDifficultyStandard(difficulty);
    return standard.description;
  }

  /**
   * 生成難度評估報告
   */
  generateDifficultyReport(
    distance: number,
    elevationGain: number,
    trackPoints: Array<{ lat: number; lon: number; altitude?: number }>
  ): {
    difficulty: RouteDifficulty;
    score: number;
    averageGradient: number;
    assessment: string;
  } {
    const difficulty = this.classifyDifficulty(distance, elevationGain, trackPoints);
    const score = this.calculateDifficultyScore(
      distance,
      elevationGain,
      (elevationGain / distance) * 100
    );
    const averageGradient = (elevationGain / distance) * 100;

    let assessment = '';
    if (difficulty === 'easy') {
      assessment = '這是一條適合初學者的輕鬆路線，適合休閒騎乘。';
    } else if (difficulty === 'moderate') {
      assessment = '這是一條中等難度的路線，需要一定的體力和技術。';
    } else if (difficulty === 'hard') {
      assessment = '這是一條困難的路線，需要良好的體力和騎乘經驗。';
    } else {
      assessment = '這是一條極具挑戰性的專家級路線，只適合專業騎手。';
    }

    return {
      difficulty,
      score,
      averageGradient,
      assessment,
    };
  }

  /**
   * 比較兩條路線的難度
   */
  compareDifficulty(
    distance1: number,
    elevation1: number,
    distance2: number,
    elevation2: number
  ): {
    route1Difficulty: RouteDifficulty;
    route2Difficulty: RouteDifficulty;
    comparison: string;
  } {
    const difficulty1 = this.classifyDifficulty(distance1, elevation1, []);
    const difficulty2 = this.classifyDifficulty(distance2, elevation2, []);

    let comparison = '';
    if (difficulty1 === difficulty2) {
      comparison = '兩條路線難度相同';
    } else {
      const difficultyOrder = ['easy', 'moderate', 'hard', 'expert'];
      const index1 = difficultyOrder.indexOf(difficulty1);
      const index2 = difficultyOrder.indexOf(difficulty2);

      if (index1 < index2) {
        comparison = `路線 1 比路線 2 簡單`;
      } else {
        comparison = `路線 1 比路線 2 困難`;
      }
    }

    return {
      route1Difficulty: difficulty1,
      route2Difficulty: difficulty2,
      comparison,
    };
  }

  /**
   * 銷毀實例
   */
  destroy(): void {
    // 清理資源
  }
}

export function getRouteDifficultyClassifier(): RouteDifficultyClassifier {
  return RouteDifficultyClassifier.getInstance();
}
