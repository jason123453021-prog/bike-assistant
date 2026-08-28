export type NavigationDashboardFieldKey =
  | "showElapsed"
  | "showSpeed"
  | "showDistance"
  | "showGrade"
  | "showPower"
  | "showAvgSpeed"
  | "showCalories"
  | "showPausedTime"
  | "showTotalAscent"
  | "showCurrentAltitude"
  | "showGradeDistribution";

export const DEFAULT_NAVIGATION_PRIMARY_FIELDS: NavigationDashboardFieldKey[] = [
  "showElapsed",
  "showSpeed",
  "showDistance",
  "showGrade",
  "showPower",
  "showTotalAscent",
];

export const DEFAULT_NAVIGATION_FIELD_ORDER: NavigationDashboardFieldKey[] = [
  ...DEFAULT_NAVIGATION_PRIMARY_FIELDS,
  "showAvgSpeed",
  "showCalories",
  "showPausedTime",
  "showCurrentAltitude",
  "showGradeDistribution",
];

const LEGACY_NAVIGATION_PRIMARY_FIELDS: NavigationDashboardFieldKey[] = [
  "showElapsed",
  "showSpeed",
  "showDistance",
  "showGrade",
  "showPower",
  "showAvgSpeed",
];

export function migrateLegacyNavigationDashboardDefaults(
  fields: Partial<Record<NavigationDashboardFieldKey, boolean>>,
  order: NavigationDashboardFieldKey[],
): {
  fields: Partial<Record<NavigationDashboardFieldKey, boolean>>;
  order: NavigationDashboardFieldKey[];
} {
  const usesLegacyPrimaryOrder = LEGACY_NAVIGATION_PRIMARY_FIELDS.every((key, index) => order[index] === key);
  const usesLegacyFieldVisibility = fields.showAvgSpeed === true && fields.showTotalAscent === false;

  if (!usesLegacyPrimaryOrder || !usesLegacyFieldVisibility) {
    return { fields, order };
  }

  const remaining = order.filter(
    (key) => !DEFAULT_NAVIGATION_PRIMARY_FIELDS.includes(key) && key !== "showAvgSpeed",
  );

  return {
    fields: {
      ...fields,
      showAvgSpeed: false,
      showTotalAscent: true,
    },
    order: [...DEFAULT_NAVIGATION_PRIMARY_FIELDS, "showAvgSpeed", ...remaining],
  };
}
