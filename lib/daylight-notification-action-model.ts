import type { DaylightAlertKind } from "./daylight-alert";

export const DAYLIGHT_SUNRISE_CATEGORY = "bike-assistant-daylight-sunrise";
export const DAYLIGHT_SUNSET_CATEGORY = "bike-assistant-daylight-sunset";
export const DAYLIGHT_CONFIRM_ACTION = "daylight-confirm";

export interface DaylightNotificationAction {
  kind: DaylightAlertKind;
  eventKey: string;
}

export function parseDaylightNotificationAction(response: {
  actionIdentifier?: string;
  notification?: { request?: { content?: { data?: Record<string, unknown> } } };
}): DaylightNotificationAction | undefined {
  const data = response.notification?.request?.content?.data;
  const kind = data?.daylightKind;
  const eventKey = data?.daylightEventKey;
  if (
    response.actionIdentifier !== DAYLIGHT_CONFIRM_ACTION
    || (kind !== "sunrise" && kind !== "sunset")
    || typeof eventKey !== "string"
    || !eventKey
  ) return undefined;
  return { kind, eventKey };
}
