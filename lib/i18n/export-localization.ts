import i18n from "./i18n";
import type { RideRecord } from "../ride-context";
import type { SupportedLocale } from "./types";

const LOCALIZED_TERMS: Record<SupportedLocale, Partial<Record<string, string>>> = {
  "en-US": {}, "zh-TW": {},
  "zh-CN": { "export.gpxPrefix": "活动", "export.fitPrefix": "活动", "export.svgPrefix": "分享卡片", "notifications.rideChannel": "骑行状态", "notifications.supplyChannel": "补给与补水", "notifications.supplyTitle": "补给提醒", "notifications.waterTitle": "补水提醒", "notifications.snooze": "稍后提醒", "notifications.confirm": "已补给", "notifications.energyVoice": "请补充能量", "notifications.waterVoice": "请补充水分" },
  "ja-JP": { "export.gpxPrefix": "アクティビティ", "export.fitPrefix": "アクティビティ", "export.svgPrefix": "共有カード", "notifications.rideChannel": "ライド状況", "notifications.supplyChannel": "補給・水分", "notifications.supplyTitle": "補給リマインダー", "notifications.waterTitle": "水分補給リマインダー", "notifications.snooze": "後で通知", "notifications.confirm": "補給済み", "notifications.energyVoice": "エネルギーを補給してください", "notifications.waterVoice": "水分を補給してください" },
  "ko-KR": { "export.gpxPrefix": "활동", "export.fitPrefix": "활동", "export.svgPrefix": "공유카드", "notifications.rideChannel": "라이딩 상태", "notifications.supplyChannel": "보급 및 수분", "notifications.supplyTitle": "보급 알림", "notifications.waterTitle": "수분 보충 알림", "notifications.snooze": "나중에 알림", "notifications.confirm": "보급 완료", "notifications.energyVoice": "에너지를 보충하세요", "notifications.waterVoice": "수분을 보충하세요" },
  "es-ES": { "export.gpxPrefix": "actividad", "export.fitPrefix": "actividad", "export.svgPrefix": "tarjeta", "notifications.rideChannel": "Estado de la salida", "notifications.supplyChannel": "Nutrición e hidratación", "notifications.supplyTitle": "Recordatorio de nutrición", "notifications.waterTitle": "Recordatorio de hidratación", "notifications.snooze": "Recordar más tarde", "notifications.confirm": "Confirmar", "notifications.energyVoice": "Repón energía", "notifications.waterVoice": "Hidrátate" },
  "pt-BR": { "export.gpxPrefix": "atividade", "export.fitPrefix": "atividade", "export.svgPrefix": "cartao", "notifications.rideChannel": "Status do pedal", "notifications.supplyChannel": "Nutrição e hidratação", "notifications.supplyTitle": "Lembrete de nutrição", "notifications.waterTitle": "Lembrete de hidratação", "notifications.snooze": "Lembrar depois", "notifications.confirm": "Confirmar", "notifications.energyVoice": "Reponha energia", "notifications.waterVoice": "Hidrate-se" },
  "fr-FR": { "export.gpxPrefix": "activite", "export.fitPrefix": "activite", "export.svgPrefix": "carte", "notifications.rideChannel": "État de la sortie", "notifications.supplyChannel": "Nutrition et hydratation", "notifications.supplyTitle": "Rappel nutrition", "notifications.waterTitle": "Rappel hydratation", "notifications.snooze": "Rappeler plus tard", "notifications.confirm": "Confirmer", "notifications.energyVoice": "Faites le plein d’énergie", "notifications.waterVoice": "Hydratez-vous" },
  "de-DE": { "export.gpxPrefix": "aktivitaet", "export.fitPrefix": "aktivitaet", "export.svgPrefix": "karte", "notifications.rideChannel": "Fahrtstatus", "notifications.supplyChannel": "Energie und Flüssigkeit", "notifications.supplyTitle": "Energieerinnerung", "notifications.waterTitle": "Trinkerinnerung", "notifications.snooze": "Später erinnern", "notifications.confirm": "Bestätigen", "notifications.energyVoice": "Energie aufnehmen", "notifications.waterVoice": "Trinken" },
  "it-IT": { "export.gpxPrefix": "attivita", "export.fitPrefix": "attivita", "export.svgPrefix": "scheda", "notifications.rideChannel": "Stato uscita", "notifications.supplyChannel": "Nutrizione e idratazione", "notifications.supplyTitle": "Promemoria energia", "notifications.waterTitle": "Promemoria idratazione", "notifications.snooze": "Ricorda più tardi", "notifications.confirm": "Conferma", "notifications.energyVoice": "Assumi energia", "notifications.waterVoice": "Idratati" },
  "nl-NL": { "export.gpxPrefix": "activiteit", "export.fitPrefix": "activiteit", "export.svgPrefix": "kaart", "notifications.rideChannel": "Ritstatus", "notifications.supplyChannel": "Voeding en hydratatie", "notifications.supplyTitle": "Voedingsherinnering", "notifications.waterTitle": "Hydratatieherinnering", "notifications.snooze": "Later herinneren", "notifications.confirm": "Bevestigen", "notifications.energyVoice": "Vul energie aan", "notifications.waterVoice": "Hydrateer" },
  "ru-RU": { "export.gpxPrefix": "активность", "export.fitPrefix": "активность", "export.svgPrefix": "карточка", "notifications.rideChannel": "Статус поездки", "notifications.supplyChannel": "Питание и гидратация", "notifications.supplyTitle": "Напоминание о питании", "notifications.waterTitle": "Напоминание о воде", "notifications.snooze": "Напомнить позже", "notifications.confirm": "Подтвердить", "notifications.energyVoice": "Восполните энергию", "notifications.waterVoice": "Попейте воды" },
  "ar-SA": { "export.gpxPrefix": "نشاط", "export.fitPrefix": "نشاط", "export.svgPrefix": "بطاقة", "notifications.rideChannel": "حالة الرحلة", "notifications.supplyChannel": "التغذية والترطيب", "notifications.supplyTitle": "تذكير بالتغذية", "notifications.waterTitle": "تذكير بالترطيب", "notifications.snooze": "ذكرني لاحقًا", "notifications.confirm": "تأكيد", "notifications.energyVoice": "جدّد طاقتك", "notifications.waterVoice": "اشرب الماء" },
};

function safeFilePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/** 依目前語系產生可分享、跨平台安全且含日期的匯出檔名。 */
export function createLocalizedExportFilename(record: RideRecord, extension: "gpx" | "fit" | "svg", locale = i18n.resolvedLanguage ?? "en-US"): string {
  const t = i18n.getFixedT(locale);
  const fallbackName = t("share.untitledRide");
  const activityName = safeFilePart(record.name || fallbackName) || "activity";
  const prefix = safeFilePart(t(`export.${extension}Prefix`)) || "activity";
  void locale;
  const date = new Date(record.date).toISOString().slice(0, 10);
  return `${prefix}-${activityName}-${date}.${extension}`;
}

export function exportTranslation(key: string, options?: Record<string, unknown>): string {
  const locale = (i18n.resolvedLanguage ?? "en-US") as SupportedLocale;
  return LOCALIZED_TERMS[locale]?.[key] ?? i18n.t(key, options);
}
