export type DaylightAlertKind = "sunrise" | "sunset";
export type DaylightAlertMode = "sunrise-and-sunset" | "sunrise-only" | "sunset-only";

export interface DaylightAlertEvent {
  key: string;
  kind: DaylightAlertKind;
  /** 實際日出或日落時刻，保留供使用者文案與可追溯性使用。 */
  eventAtMs: number;
  /** 套用使用者提前分鐘數後的提醒觸發時刻。 */
  triggerAtMs: number;
}

export const DAYLIGHT_ALERT_LEAD_MINUTES_PRESETS = [0, 5, 10, 15, 30] as const;
export const DEFAULT_DAYLIGHT_ALERT_LEAD_MINUTES = 0;
export const MAX_DAYLIGHT_ALERT_LEAD_MINUTES = 60;

export function isDaylightAlertKindEnabled(kind: DaylightAlertKind, mode: DaylightAlertMode = "sunrise-and-sunset") {
  return mode === "sunrise-and-sunset"
    || (mode === "sunrise-only" && kind === "sunrise")
    || (mode === "sunset-only" && kind === "sunset");
}

export function normalizeDaylightAlertMode(value: unknown): DaylightAlertMode {
  if (value === "sunrise-only" || value === "sunset-only") return value;
  return "sunrise-and-sunset";
}

export function normalizeDaylightAlertLeadMinutes(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_DAYLIGHT_ALERT_LEAD_MINUTES;
  return Math.min(MAX_DAYLIGHT_ALERT_LEAD_MINUTES, Math.max(0, Math.round(numeric)));
}

const ZENITH_DEG = 90.833;

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((current - start) / 86_400_000);
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * NOAA 公開太陽位置近似式。只使用裝置日期與 GPS 座標，無網路與帳號依賴。
 * 極區日／夜無日出日落交點時安全回傳 undefined。
 */
function calculateSolarEventMs(date: Date, latitude: number, longitude: number, kind: DaylightAlertKind): number | undefined {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 89.8) return undefined;
  const day = dayOfYear(date);
  const gamma = (2 * Math.PI / 365) * (day - 1);
  const equationOfTimeMinutes = 229.18 * (
    0.000075
    + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma)
  );
  const declination = 0.006918
    - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma)
    + 0.00148 * Math.sin(3 * gamma);
  const latitudeRadians = (latitude * Math.PI) / 180;
  const zenithRadians = (ZENITH_DEG * Math.PI) / 180;
  const hourAngleCosine = (Math.cos(zenithRadians) / (Math.cos(latitudeRadians) * Math.cos(declination)))
    - Math.tan(latitudeRadians) * Math.tan(declination);
  if (hourAngleCosine < -1 || hourAngleCosine > 1) return undefined;
  const hourAngleDegrees = (Math.acos(hourAngleCosine) * 180) / Math.PI;
  const utcMinutes = 720 - (4 * (longitude + (kind === "sunrise" ? hourAngleDegrees : -hourAngleDegrees))) - equationOfTimeMinutes;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) + Math.round(utcMinutes * 60_000);
}

export function getDaylightEvents(date: Date, latitude: number, longitude: number, leadMinutes = DEFAULT_DAYLIGHT_ALERT_LEAD_MINUTES): DaylightAlertEvent[] {
  const normalizedLeadMinutes = normalizeDaylightAlertLeadMinutes(leadMinutes);
  return (["sunrise", "sunset"] as const).flatMap((kind) => {
    const eventAtMs = calculateSolarEventMs(date, latitude, longitude, kind);
    return eventAtMs === undefined ? [] : [{
      key: `${localDateKey(date)}-${kind}`,
      kind,
      eventAtMs,
      triggerAtMs: eventAtMs - normalizedLeadMinutes * 60_000,
    }];
  }).sort((a, b) => a.triggerAtMs - b.triggerAtMs);
}

function datesBetween(startedAtMs: number, nowMs: number) {
  const dates: Date[] = [];
  const cursor = new Date(startedAtMs);
  cursor.setHours(12, 0, 0, 0);
  // 太陽位置公式以裝置所在地日曆日計算；在 UTC 與使用者所在地相差較大時，
  // 清晨日出可能落在 UTC 前一日，因此兩端各保留一個日曆日候選。
  cursor.setDate(cursor.getDate() - 1);
  const end = new Date(nowMs);
  end.setHours(12, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  while (cursor.getTime() <= end.getTime() && dates.length < 5) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function getDueDaylightAlert(input: {
  nowMs: number;
  rideStartedAtMs: number;
  latitude: number;
  longitude: number;
  acknowledgedKeys: ReadonlySet<string>;
  leadMinutes?: number;
  mode?: DaylightAlertMode;
}): DaylightAlertEvent | undefined {
  const dueEvents = datesBetween(input.rideStartedAtMs, input.nowMs)
    .flatMap((date) => getDaylightEvents(date, input.latitude, input.longitude, input.leadMinutes))
    .filter((event) => isDaylightAlertKindEnabled(event.kind, input.mode))
    .filter((event) => event.triggerAtMs >= input.rideStartedAtMs && event.triggerAtMs <= input.nowMs && !input.acknowledgedKeys.has(event.key));
  return dueEvents.at(-1);
}

export function getNextDaylightAlert(input: {
  nowMs: number;
  rideStartedAtMs: number;
  latitude: number;
  longitude: number;
  acknowledgedKeys: ReadonlySet<string>;
  leadMinutes?: number;
  mode?: DaylightAlertMode;
}): DaylightAlertEvent | undefined {
  const tomorrow = new Date(input.nowMs);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [new Date(input.nowMs), tomorrow]
    .flatMap((date) => getDaylightEvents(date, input.latitude, input.longitude, input.leadMinutes))
    .find((event) => isDaylightAlertKindEnabled(event.kind, input.mode) && event.triggerAtMs > input.nowMs && event.triggerAtMs >= input.rideStartedAtMs && !input.acknowledgedKeys.has(event.key));
}

export function daylightAlertCopy(kind: DaylightAlertKind, leadMinutes = DEFAULT_DAYLIGHT_ALERT_LEAD_MINUTES) {
  const normalizedLeadMinutes = normalizeDaylightAlertLeadMinutes(leadMinutes);
  const early = normalizedLeadMinutes > 0;
  return kind === "sunrise"
    ? {
        title: early ? "日出提前安全提醒" : "日出安全提醒",
        body: early ? `約 ${normalizedLeadMinutes} 分鐘後日出，請確認後關閉您的警示燈。` : "天色已亮，請確認後關閉您的警示燈。",
        confirmation: "已關閉警示燈",
      }
    : {
        title: early ? "日落提前安全提醒" : "日落安全提醒",
        body: early ? `約 ${normalizedLeadMinutes} 分鐘後日落，請確認後開啟您的警示燈。` : "天色將暗，請確認後開啟您的警示燈。",
        confirmation: "已開啟警示燈",
      };
}
