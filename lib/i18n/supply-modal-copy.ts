import type { SupportedLocale } from "./types";

export interface SupplyModalCopy {
  reminderTitle: string;
  energyTitle: string;
  waterTitle: string;
  bothPending: string;
  energyBody: string;
  waterBody: string;
  energyConfirm: string;
  waterConfirm: string;
  energyRestart: string;
  waterRestart: string;
  customEnergyBody: string;
  customWaterBody: string;
  customConfirmPrefix: string;
  safetyHint: string;
  snooze: string;
}

export const SUPPLY_MODAL_COPY: Record<SupportedLocale, SupplyModalCopy> = {
  "zh-TW": {
    reminderTitle: "補給提醒",
    energyTitle: "補充能量",
    waterTitle: "補充水分",
    bothPending: "兩項皆待確認，可依任意順序完成",
    energyBody: "請補給能量，確認後立即開始下一輪能量倒數。",
    waterBody: "請補給水分，確認後立即開始下一輪補水倒數。",
    energyConfirm: "已補給能量",
    waterConfirm: "已補給水分",
    energyRestart: "重新開始能量倒數",
    waterRestart: "重新開始補水倒數",
    customEnergyBody: "請補給能量，提醒設定與能量共用。",
    customWaterBody: "請補給水分，提醒設定與補水共用。",
    customConfirmPrefix: "確認已補給",
    safetyHint: "請分別確認已完成的補給項目。",
    snooze: "稍後提醒",
  },
  "zh-CN": {
    reminderTitle: "补给提醒",
    energyTitle: "补充能量",
    waterTitle: "补充水分",
    bothPending: "两项均待确认，可按任意顺序完成",
    energyBody: "请补充能量，确认后立即开始下一轮能量倒计时。",
    waterBody: "请补充水分，确认后立即开始下一轮补水倒计时。",
    energyConfirm: "已补充能量",
    waterConfirm: "已补充水分",
    energyRestart: "重新开始能量倒计时",
    waterRestart: "重新开始补水倒计时",
    customEnergyBody: "请补充能量，提醒设置与能量共用。",
    customWaterBody: "请补充水分，提醒设置与补水共用。",
    customConfirmPrefix: "确认已补充",
    safetyHint: "请分别确认已完成的补给项目。",
    snooze: "稍后提醒",
  },
  "en-US": {
    reminderTitle: "Supply reminder",
    energyTitle: "Refuel",
    waterTitle: "Hydrate",
    bothPending:
      "Both reminders need confirmation. Complete them in any order.",
    energyBody: "Refuel now. Confirm to start the next fuel countdown.",
    waterBody: "Hydrate now. Confirm to start the next hydration countdown.",
    energyConfirm: "Fuel completed",
    waterConfirm: "Hydration completed",
    energyRestart: "Start the next fuel countdown",
    waterRestart: "Start the next hydration countdown",
    customEnergyBody: "Refuel now. This reminder shares the fuel settings.",
    customWaterBody:
      "Hydrate now. This reminder shares the hydration settings.",
    customConfirmPrefix: "Confirm",
    safetyHint: "Confirm each completed supply item separately.",
    snooze: "Remind later",
  },
  "ja-JP": {
    reminderTitle: "補給リマインダー",
    energyTitle: "エネルギー補給",
    waterTitle: "水分補給",
    bothPending: "両方の確認が必要です。順番は問いません。",
    energyBody:
      "エネルギーを補給してください。確認すると次のカウントダウンを開始します。",
    waterBody:
      "水分を補給してください。確認すると次のカウントダウンを開始します。",
    energyConfirm: "エネルギーを補給しました",
    waterConfirm: "水分を補給しました",
    energyRestart: "次のエネルギーのカウントダウンを開始",
    waterRestart: "次の水分のカウントダウンを開始",
    customEnergyBody:
      "エネルギーを補給してください。このリマインダーはエネルギー設定を共有します。",
    customWaterBody:
      "水分を補給してください。このリマインダーは水分設定を共有します。",
    customConfirmPrefix: "補給を確認",
    safetyHint: "完了した補給項目をそれぞれ確認してください。",
    snooze: "後で通知",
  },
  "ko-KR": {
    reminderTitle: "보급 알림",
    energyTitle: "에너지 보충",
    waterTitle: "수분 보충",
    bothPending:
      "두 항목 모두 확인이 필요합니다. 순서와 관계없이 완료할 수 있습니다.",
    energyBody:
      "에너지를 보충하세요. 확인하면 다음 에너지 카운트다운이 시작됩니다.",
    waterBody: "수분을 보충하세요. 확인하면 다음 수분 카운트다운이 시작됩니다.",
    energyConfirm: "에너지 보충 완료",
    waterConfirm: "수분 보충 완료",
    energyRestart: "다음 에너지 카운트다운 시작",
    waterRestart: "다음 수분 카운트다운 시작",
    customEnergyBody:
      "에너지를 보충하세요. 이 알림은 에너지 설정을 공유합니다.",
    customWaterBody: "수분을 보충하세요. 이 알림은 수분 설정을 공유합니다.",
    customConfirmPrefix: "보충 확인",
    safetyHint: "완료한 보급 항목을 각각 확인하세요.",
    snooze: "나중에 알림",
  },
  "es-ES": {
    reminderTitle: "Recordatorio de nutrición",
    energyTitle: "Reponer energía",
    waterTitle: "Hidratarse",
    bothPending:
      "Ambos recordatorios esperan confirmación. Complétalos en cualquier orden.",
    energyBody:
      "Repón energía. Confirma para iniciar la siguiente cuenta atrás de energía.",
    waterBody:
      "Hidrátate. Confirma para iniciar la siguiente cuenta atrás de hidratación.",
    energyConfirm: "Energía repuesta",
    waterConfirm: "Hidratación completada",
    energyRestart: "Iniciar la siguiente cuenta atrás de energía",
    waterRestart: "Iniciar la siguiente cuenta atrás de hidratación",
    customEnergyBody:
      "Repón energía. Este recordatorio comparte la configuración de energía.",
    customWaterBody:
      "Hidrátate. Este recordatorio comparte la configuración de hidratación.",
    customConfirmPrefix: "Confirmar",
    safetyHint: "Confirma por separado cada elemento de nutrición completado.",
    snooze: "Recordar más tarde",
  },
  "pt-BR": {
    reminderTitle: "Lembrete de nutrição",
    energyTitle: "Repor energia",
    waterTitle: "Hidratar",
    bothPending:
      "Os dois lembretes aguardam confirmação. Conclua-os em qualquer ordem.",
    energyBody:
      "Reponha energia. Confirme para iniciar a próxima contagem de energia.",
    waterBody:
      "Hidrate-se. Confirme para iniciar a próxima contagem de hidratação.",
    energyConfirm: "Energia reposta",
    waterConfirm: "Hidratação concluída",
    energyRestart: "Iniciar a próxima contagem de energia",
    waterRestart: "Iniciar a próxima contagem de hidratação",
    customEnergyBody:
      "Reponha energia. Este lembrete usa as configurações de energia.",
    customWaterBody:
      "Hidrate-se. Este lembrete usa as configurações de hidratação.",
    customConfirmPrefix: "Confirmar",
    safetyHint: "Confirme separadamente cada item de nutrição concluído.",
    snooze: "Lembrar mais tarde",
  },
  "fr-FR": {
    reminderTitle: "Rappel de nutrition",
    energyTitle: "Faire le plein d’énergie",
    waterTitle: "S’hydrater",
    bothPending:
      "Les deux rappels attendent une confirmation. Terminez-les dans l’ordre de votre choix.",
    energyBody:
      "Faites le plein d’énergie. Confirmez pour démarrer le prochain compte à rebours.",
    waterBody:
      "Hydratez-vous. Confirmez pour démarrer le prochain compte à rebours d’hydratation.",
    energyConfirm: "Énergie prise",
    waterConfirm: "Hydratation terminée",
    energyRestart: "Démarrer le prochain compte à rebours d’énergie",
    waterRestart: "Démarrer le prochain compte à rebours d’hydratation",
    customEnergyBody:
      "Faites le plein d’énergie. Ce rappel partage les réglages d’énergie.",
    customWaterBody:
      "Hydratez-vous. Ce rappel partage les réglages d’hydratation.",
    customConfirmPrefix: "Confirmer",
    safetyHint: "Confirmez séparément chaque apport terminé.",
    snooze: "Rappeler plus tard",
  },
  "de-DE": {
    reminderTitle: "Versorgungserinnerung",
    energyTitle: "Energie auffüllen",
    waterTitle: "Trinken",
    bothPending:
      "Beide Erinnerungen warten auf Bestätigung. Die Reihenfolge ist beliebig.",
    energyBody:
      "Bitte Energie auffüllen. Nach der Bestätigung beginnt der nächste Energie-Countdown.",
    waterBody:
      "Bitte trinken. Nach der Bestätigung beginnt der nächste Trink-Countdown.",
    energyConfirm: "Energie aufgefüllt",
    waterConfirm: "Flüssigkeit aufgenommen",
    energyRestart: "Nächsten Energie-Countdown starten",
    waterRestart: "Nächsten Trink-Countdown starten",
    customEnergyBody:
      "Bitte Energie auffüllen. Diese Erinnerung verwendet die Energieeinstellungen.",
    customWaterBody:
      "Bitte trinken. Diese Erinnerung verwendet die Trink-Einstellungen.",
    customConfirmPrefix: "Bestätigen",
    safetyHint: "Bestätigen Sie jeden erledigten Versorgungspunkt einzeln.",
    snooze: "Später erinnern",
  },
  "it-IT": {
    reminderTitle: "Promemoria rifornimento",
    energyTitle: "Rifornisci energia",
    waterTitle: "Idratati",
    bothPending:
      "Entrambi i promemoria attendono conferma. Completali in qualsiasi ordine.",
    energyBody:
      "Rifornisci energia. Conferma per avviare il prossimo conto alla rovescia.",
    waterBody:
      "Idratati. Conferma per avviare il prossimo conto alla rovescia dell’idratazione.",
    energyConfirm: "Energia reintegrata",
    waterConfirm: "Idratazione completata",
    energyRestart: "Avvia il prossimo conto alla rovescia dell’energia",
    waterRestart: "Avvia il prossimo conto alla rovescia dell’idratazione",
    customEnergyBody:
      "Rifornisci energia. Questo promemoria usa le impostazioni dell’energia.",
    customWaterBody:
      "Idratati. Questo promemoria usa le impostazioni dell’idratazione.",
    customConfirmPrefix: "Conferma",
    safetyHint: "Conferma separatamente ogni rifornimento completato.",
    snooze: "Ricorda più tardi",
  },
  "nl-NL": {
    reminderTitle: "Voedingsherinnering",
    energyTitle: "Energie aanvullen",
    waterTitle: "Hydrateren",
    bothPending:
      "Beide herinneringen wachten op bevestiging. Voltooi ze in willekeurige volgorde.",
    energyBody:
      "Vul energie aan. Bevestig om de volgende energieteller te starten.",
    waterBody:
      "Hydrateer. Bevestig om de volgende hydratatieteller te starten.",
    energyConfirm: "Energie aangevuld",
    waterConfirm: "Hydratatie voltooid",
    energyRestart: "Volgende energieteller starten",
    waterRestart: "Volgende hydratatieteller starten",
    customEnergyBody:
      "Vul energie aan. Deze herinnering gebruikt de energie-instellingen.",
    customWaterBody:
      "Hydrateer. Deze herinnering gebruikt de hydratatie-instellingen.",
    customConfirmPrefix: "Bevestigen",
    safetyHint: "Bevestig elk voltooid voedingsitem afzonderlijk.",
    snooze: "Later herinneren",
  },
  "ru-RU": {
    reminderTitle: "Напоминание о питании",
    energyTitle: "Пополнить энергию",
    waterTitle: "Восполнить воду",
    bothPending:
      "Оба напоминания ждут подтверждения. Выполните их в любом порядке.",
    energyBody:
      "Пополните энергию. Подтвердите, чтобы начать следующий отсчёт энергии.",
    waterBody:
      "Восполните воду. Подтвердите, чтобы начать следующий отсчёт воды.",
    energyConfirm: "Энергия восполнена",
    waterConfirm: "Вода восполнена",
    energyRestart: "Начать следующий отсчёт энергии",
    waterRestart: "Начать следующий отсчёт воды",
    customEnergyBody:
      "Пополните энергию. Это напоминание использует настройки энергии.",
    customWaterBody:
      "Восполните воду. Это напоминание использует настройки воды.",
    customConfirmPrefix: "Подтвердить",
    safetyHint: "Подтвердите каждый завершённый пункт питания отдельно.",
    snooze: "Напомнить позже",
  },
  "ar-SA": {
    reminderTitle: "تذكير بالتزوّد",
    energyTitle: "تزوّد بالطاقة",
    waterTitle: "تزوّد بالماء",
    bothPending: "كلا التذكيرين بانتظار التأكيد. يمكنك إكمالهما بأي ترتيب.",
    energyBody: "تزوّد بالطاقة. أكّد لبدء العد التنازلي التالي للطاقة.",
    waterBody: "تزوّد بالماء. أكّد لبدء العد التنازلي التالي للترطيب.",
    energyConfirm: "تم التزوّد بالطاقة",
    waterConfirm: "تم التزوّد بالماء",
    energyRestart: "بدء العد التنازلي التالي للطاقة",
    waterRestart: "بدء العد التنازلي التالي للترطيب",
    customEnergyBody: "تزوّد بالطاقة. يشارك هذا التذكير إعدادات الطاقة.",
    customWaterBody: "تزوّد بالماء. يشارك هذا التذكير إعدادات الترطيب.",
    customConfirmPrefix: "تأكيد",
    safetyHint: "أكّد كل عنصر تزوّد مكتمل بشكل منفصل.",
    snooze: "ذكّرني لاحقًا",
  },
};

export function getSupplyModalCopy(locale: SupportedLocale): SupplyModalCopy {
  return SUPPLY_MODAL_COPY[locale];
}
