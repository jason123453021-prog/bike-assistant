export type CourseTurnDirection = "left" | "right";
export type CoursePromptTranslator = (key: string) => string;

/**
 * 僅格式化已由 COG／GPX 向量判定出的轉彎文字；不參與距離、航向或左右轉幾何演算。
 */
export function formatCourseNavigationPrompt(
  translate: CoursePromptTranslator,
  direction: CourseTurnDirection,
  distanceM: number,
): string {
  const directionLabel = translate(direction === "left" ? "navigation.turnLeft" : "navigation.turnRight");
  if (distanceM <= 50) return `${translate("navigation.approachingTurn")}：${directionLabel}`;
  return `${Math.round(Math.max(0, distanceM))} m · ${directionLabel}`;
}
