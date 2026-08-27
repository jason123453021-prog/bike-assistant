import type { SupportedLocale } from "./types";

export const PERMISSION_TRANSLATIONS: Record<
  SupportedLocale,
  Record<string, string>
> = {
  "en-US": {
    title: "Background ride readiness",
    hint: "Complete these settings for more reliable locked-screen GPS and fuel reminders.",
    notifications: "Fuel and navigation notifications",
    location: "Precise and background location",
    battery: "Unrestricted battery",
    allowNotifications: "Allow notifications",
    allowLocation: "Allow location",
    openSettings: "Open settings",
    allowed: "Allowed",
    systemSettingRequired: "Complete this item in system settings",
    opening: "Opening…",
    check: "Check",
    batteryNote:
      "Battery limits are managed by your phone. In settings, make this app unrestricted or disable battery optimisation.",
    backgroundDisclosureTitle: "Allow background ride tracking?",
    backgroundDisclosurePurpose:
      "When you choose to start a ride, Cycling Assistant needs background location to continue recording speed, distance, and route while the screen is locked or the app is in the background.",
    backgroundDisclosureData:
      "• It uses your precise location only for the active ride record on this device.",
    backgroundDisclosureStop:
      "• Background tracking stops when you finish the ride.",
    backgroundDisclosureSystem:
      "• Android will next open a system permission setting. You can decline or change this later in Settings.",
    backgroundDisclosureNotNow: "Not now",
    backgroundDisclosureContinue: "I understand, continue",
  },
  "zh-TW": {
    title: "背景騎乘準備",
    hint: "完成以下設定，讓鎖屏 GPS 與補給提醒更可靠。",
    notifications: "補給與導航通知",
    location: "精確與背景位置",
    battery: "電池不受限制",
    allowNotifications: "允許通知",
    allowLocation: "允許位置",
    openSettings: "前往設定",
    allowed: "已允許",
    systemSettingRequired: "請在系統設定完成此項目",
    opening: "開啟中",
    check: "檢查",
    batteryNote:
      "電池限制由各手機系統管理；前往設定後，請將本 App 設為不受限制或關閉電池最佳化。",
    backgroundDisclosureTitle: "允許背景騎乘追蹤？",
    backgroundDisclosurePurpose:
      "當您選擇開始騎乘時，單車助手需要背景位置權限，才能在螢幕鎖定或 App 進入背景後持續記錄速度、距離與路線。",
    backgroundDisclosureData: "• 僅在本機使用精確位置建立進行中的騎乘紀錄。",
    backgroundDisclosureStop: "• 完成騎乘後，背景追蹤會停止。",
    backgroundDisclosureSystem:
      "• 接下來 Android 會開啟系統權限設定；您可拒絕，或稍後在系統設定中變更。",
    backgroundDisclosureNotNow: "暫不允許",
    backgroundDisclosureContinue: "我已了解，繼續",
  },
  "zh-CN": {
    title: "后台骑行准备",
    hint: "完成以下设置，让锁屏 GPS 与补给提醒更可靠。",
    notifications: "补给与导航通知",
    location: "精确与后台位置",
    battery: "电池不受限制",
    allowNotifications: "允许通知",
    allowLocation: "允许位置",
    openSettings: "前往设置",
    allowed: "已允许",
    systemSettingRequired: "请在系统设置完成此项目",
    opening: "正在打开",
    check: "检查",
    batteryNote:
      "电池限制由手机系统管理；请在设置中将本应用设为不受限制或关闭电池优化。",
    backgroundDisclosureTitle: "允许后台骑行追踪？",
    backgroundDisclosurePurpose:
      "当您选择开始骑行时，单车助手需要后台位置权限，才能在锁屏或应用进入后台后持续记录速度、距离和路线。",
    backgroundDisclosureData: "• 仅在本机使用精确位置建立进行中的骑行记录。",
    backgroundDisclosureStop: "• 完成骑行后，后台追踪会停止。",
    backgroundDisclosureSystem:
      "• 接下来 Android 会打开系统权限设置；您可以拒绝，或稍后在系统设置中更改。",
    backgroundDisclosureNotNow: "暂不允许",
    backgroundDisclosureContinue: "我已了解，继续",
  },
  "ja-JP": {
    title: "バックグラウンド走行の準備",
    hint: "画面ロック中の GPS と補給リマインダーを安定させるため、以下を設定してください。",
    notifications: "補給とナビゲーションの通知",
    location: "高精度・バックグラウンド位置情報",
    battery: "バッテリー制限なし",
    allowNotifications: "通知を許可",
    allowLocation: "位置情報を許可",
    openSettings: "設定を開く",
    allowed: "許可済み",
    systemSettingRequired: "システム設定でこの項目を完了してください",
    opening: "開いています…",
    check: "確認",
    batteryNote:
      "バッテリー制限は端末で管理されます。設定でこのアプリを制限なしにするか、バッテリー最適化を無効にしてください。",
    backgroundDisclosureTitle: "バックグラウンドで走行を記録しますか？",
    backgroundDisclosurePurpose:
      "走行開始を選択したとき、画面ロック中またはアプリがバックグラウンドにある間も、速度・距離・ルートを記録するためにバックグラウンドの位置情報が必要です。",
    backgroundDisclosureData:
      "• 正確な位置情報は、この端末の進行中の走行記録にのみ使用します。",
    backgroundDisclosureStop:
      "• 走行を終了すると、バックグラウンド記録は停止します。",
    backgroundDisclosureSystem:
      "• 次に Android のシステム権限設定が開きます。拒否したり、後で設定から変更したりできます。",
    backgroundDisclosureNotNow: "今はしない",
    backgroundDisclosureContinue: "理解して続ける",
  },
  "ko-KR": {
    title: "백그라운드 라이딩 준비",
    hint: "잠금 화면 GPS 및 보급 알림을 안정적으로 사용하려면 아래를 설정하세요.",
    notifications: "보급 및 내비게이션 알림",
    location: "정확한 백그라운드 위치",
    battery: "배터리 제한 없음",
    allowNotifications: "알림 허용",
    allowLocation: "위치 허용",
    openSettings: "설정 열기",
    allowed: "허용됨",
    systemSettingRequired: "시스템 설정에서 이 항목을 완료하세요",
    opening: "여는 중…",
    check: "확인",
    batteryNote:
      "배터리 제한은 휴대전화에서 관리합니다. 설정에서 이 앱을 제한 없음으로 설정하거나 배터리 최적화를 끄세요.",
    backgroundDisclosureTitle: "백그라운드 라이딩 추적을 허용할까요?",
    backgroundDisclosurePurpose:
      "라이딩 시작을 선택하면 화면이 잠기거나 앱이 백그라운드에 있어도 속도, 거리 및 경로를 계속 기록하기 위해 백그라운드 위치 권한이 필요합니다.",
    backgroundDisclosureData:
      "• 정확한 위치는 이 기기의 진행 중인 라이딩 기록에만 사용합니다.",
    backgroundDisclosureStop:
      "• 라이딩을 완료하면 백그라운드 추적이 중지됩니다.",
    backgroundDisclosureSystem:
      "• 다음에 Android 시스템 권한 설정이 열립니다. 거부하거나 나중에 설정에서 변경할 수 있습니다.",
    backgroundDisclosureNotNow: "나중에",
    backgroundDisclosureContinue: "이해했으며 계속",
  },
  "es-ES": {
    title: "Preparación para actividad en segundo plano",
    hint: "Completa estos ajustes para un GPS bloqueado y recordatorios más fiables.",
    notifications: "Notificaciones de nutrición y navegación",
    location: "Ubicación precisa y en segundo plano",
    battery: "Batería sin restricciones",
    allowNotifications: "Permitir notificaciones",
    allowLocation: "Permitir ubicación",
    openSettings: "Abrir ajustes",
    allowed: "Permitido",
    systemSettingRequired: "Completa este elemento en los ajustes del sistema",
    opening: "Abriendo…",
    check: "Comprobar",
    batteryNote:
      "Los límites de batería los gestiona tu teléfono. En ajustes, deja esta aplicación sin restricciones o desactiva la optimización de batería.",
    backgroundDisclosureTitle:
      "¿Permitir el seguimiento de la actividad en segundo plano?",
    backgroundDisclosurePurpose:
      "Cuando eliges iniciar una actividad, Cycling Assistant necesita ubicación en segundo plano para seguir registrando velocidad, distancia y ruta con la pantalla bloqueada o la aplicación en segundo plano.",
    backgroundDisclosureData:
      "• Tu ubicación precisa solo se usa para el registro de la actividad activa en este dispositivo.",
    backgroundDisclosureStop:
      "• El seguimiento en segundo plano se detiene al finalizar la actividad.",
    backgroundDisclosureSystem:
      "• Android abrirá ahora una configuración del sistema. Puedes rechazarlo o cambiarlo después en Ajustes.",
    backgroundDisclosureNotNow: "Ahora no",
    backgroundDisclosureContinue: "Entiendo, continuar",
  },
  "pt-BR": {
    title: "Preparação para pedal em segundo plano",
    hint: "Conclua estas configurações para GPS com tela bloqueada e lembretes mais confiáveis.",
    notifications: "Notificações de nutrição e navegação",
    location: "Localização precisa e em segundo plano",
    battery: "Bateria sem restrição",
    allowNotifications: "Permitir notificações",
    allowLocation: "Permitir localização",
    openSettings: "Abrir configurações",
    allowed: "Permitido",
    systemSettingRequired: "Conclua este item nas configurações do sistema",
    opening: "Abrindo…",
    check: "Verificar",
    batteryNote:
      "Os limites de bateria são gerenciados pelo telefone. Nas configurações, deixe este app sem restrições ou desative a otimização de bateria.",
    backgroundDisclosureTitle:
      "Permitir rastreamento do pedal em segundo plano?",
    backgroundDisclosurePurpose:
      "Ao escolher iniciar um pedal, o Cycling Assistant precisa da localização em segundo plano para continuar registrando velocidade, distância e rota com a tela bloqueada ou o app em segundo plano.",
    backgroundDisclosureData:
      "• Sua localização precisa é usada somente para o registro do pedal ativo neste dispositivo.",
    backgroundDisclosureStop:
      "• O rastreamento em segundo plano para quando você encerra o pedal.",
    backgroundDisclosureSystem:
      "• O Android abrirá uma configuração de permissão do sistema. Você pode recusar ou alterar isso depois nas Configurações.",
    backgroundDisclosureNotNow: "Agora não",
    backgroundDisclosureContinue: "Entendi, continuar",
  },
  "fr-FR": {
    title: "Préparation de l'activité en arrière-plan",
    hint: "Terminez ces réglages pour un GPS verrouillé et des rappels plus fiables.",
    notifications: "Notifications de nutrition et navigation",
    location: "Position précise et en arrière-plan",
    battery: "Batterie sans restriction",
    allowNotifications: "Autoriser les notifications",
    allowLocation: "Autoriser la position",
    openSettings: "Ouvrir les réglages",
    allowed: "Autorisé",
    systemSettingRequired: "Terminez cet élément dans les réglages système",
    opening: "Ouverture…",
    check: "Vérifier",
    batteryNote:
      "Les limites de batterie sont gérées par votre téléphone. Dans les réglages, désactivez les restrictions pour cette app ou l'optimisation de batterie.",
    backgroundDisclosureTitle:
      "Autoriser le suivi de l'activité en arrière-plan ?",
    backgroundDisclosurePurpose:
      "Lorsque vous démarrez une activité, Cycling Assistant a besoin de la position en arrière-plan pour continuer à enregistrer vitesse, distance et itinéraire écran verrouillé ou application en arrière-plan.",
    backgroundDisclosureData:
      "• Votre position précise est utilisée uniquement pour l'enregistrement de l'activité en cours sur cet appareil.",
    backgroundDisclosureStop:
      "• Le suivi en arrière-plan s'arrête lorsque vous terminez l'activité.",
    backgroundDisclosureSystem:
      "• Android ouvrira ensuite un réglage d'autorisation système. Vous pouvez refuser ou modifier ce choix plus tard dans les Réglages.",
    backgroundDisclosureNotNow: "Pas maintenant",
    backgroundDisclosureContinue: "J'ai compris, continuer",
  },
  "de-DE": {
    title: "Vorbereitung für Hintergrundfahrt",
    hint: "Schließen Sie diese Einstellungen für zuverlässigeres GPS bei gesperrtem Bildschirm und Erinnerungen ab.",
    notifications: "Ernährungs- und Navigationsbenachrichtigungen",
    location: "Präziser Standort im Hintergrund",
    battery: "Uneingeschränkter Akku",
    allowNotifications: "Benachrichtigungen erlauben",
    allowLocation: "Standort erlauben",
    openSettings: "Einstellungen öffnen",
    allowed: "Erlaubt",
    systemSettingRequired:
      "Schließen Sie diesen Punkt in den Systemeinstellungen ab",
    opening: "Wird geöffnet…",
    check: "Prüfen",
    batteryNote:
      "Akkubeschränkungen werden vom Telefon verwaltet. Setzen Sie diese App in den Einstellungen auf uneingeschränkt oder deaktivieren Sie die Akkuoptimierung.",
    backgroundDisclosureTitle: "Fahrtaufzeichnung im Hintergrund erlauben?",
    backgroundDisclosurePurpose:
      "Wenn Sie eine Fahrt starten, benötigt Cycling Assistant den Standort im Hintergrund, um Geschwindigkeit, Strecke und Route auch bei gesperrtem Bildschirm oder im Hintergrund weiter aufzuzeichnen.",
    backgroundDisclosureData:
      "• Ihr genauer Standort wird nur für die laufende Fahrtaufzeichnung auf diesem Gerät verwendet.",
    backgroundDisclosureStop:
      "• Die Hintergrundaufzeichnung endet, wenn Sie die Fahrt beenden.",
    backgroundDisclosureSystem:
      "• Android öffnet als Nächstes eine Systemeinstellung für die Berechtigung. Sie können ablehnen oder dies später in den Einstellungen ändern.",
    backgroundDisclosureNotNow: "Jetzt nicht",
    backgroundDisclosureContinue: "Verstanden, weiter",
  },
  "it-IT": {
    title: "Preparazione attività in background",
    hint: "Completa queste impostazioni per GPS a schermo bloccato e promemoria più affidabili.",
    notifications: "Notifiche di rifornimento e navigazione",
    location: "Posizione precisa e in background",
    battery: "Batteria senza limiti",
    allowNotifications: "Consenti notifiche",
    allowLocation: "Consenti posizione",
    openSettings: "Apri impostazioni",
    allowed: "Consentito",
    systemSettingRequired:
      "Completa questo elemento nelle impostazioni di sistema",
    opening: "Apertura…",
    check: "Verifica",
    batteryNote:
      "I limiti della batteria sono gestiti dal telefono. Nelle impostazioni, rendi questa app senza limiti o disattiva l'ottimizzazione della batteria.",
    backgroundDisclosureTitle:
      "Consentire il tracciamento dell'attività in background?",
    backgroundDisclosurePurpose:
      "Quando scegli di iniziare un'attività, Cycling Assistant richiede la posizione in background per continuare a registrare velocità, distanza e percorso con schermo bloccato o app in background.",
    backgroundDisclosureData:
      "• La posizione precisa viene usata solo per il record dell'attività attiva su questo dispositivo.",
    backgroundDisclosureStop:
      "• Il tracciamento in background si interrompe quando termini l'attività.",
    backgroundDisclosureSystem:
      "• Android aprirà ora un'impostazione di autorizzazione del sistema. Puoi rifiutare o modificare la scelta in seguito nelle Impostazioni.",
    backgroundDisclosureNotNow: "Non ora",
    backgroundDisclosureContinue: "Ho capito, continua",
  },
  "nl-NL": {
    title: "Voorbereiding rit op de achtergrond",
    hint: "Voltooi deze instellingen voor betrouwbaardere GPS bij vergrendeld scherm en herinneringen.",
    notifications: "Voedings- en navigatiemeldingen",
    location: "Nauwkeurige locatie op de achtergrond",
    battery: "Onbeperkte batterij",
    allowNotifications: "Meldingen toestaan",
    allowLocation: "Locatie toestaan",
    openSettings: "Instellingen openen",
    allowed: "Toegestaan",
    systemSettingRequired: "Voltooi dit onderdeel in de systeeminstellingen",
    opening: "Openen…",
    check: "Controleren",
    batteryNote:
      "Batterijbeperkingen worden door uw telefoon beheerd. Maak deze app in de instellingen onbeperkt of schakel batterijoptimalisatie uit.",
    backgroundDisclosureTitle: "Ritregistratie op de achtergrond toestaan?",
    backgroundDisclosurePurpose:
      "Wanneer u een rit start, heeft Cycling Assistant locatie op de achtergrond nodig om snelheid, afstand en route te blijven registreren terwijl het scherm is vergrendeld of de app op de achtergrond staat.",
    backgroundDisclosureData:
      "• Uw nauwkeurige locatie wordt alleen gebruikt voor de actieve ritregistratie op dit apparaat.",
    backgroundDisclosureStop:
      "• Registratie op de achtergrond stopt wanneer u de rit beëindigt.",
    backgroundDisclosureSystem:
      "• Android opent hierna een systeeminstelling voor de toestemming. U kunt weigeren of dit later wijzigen in Instellingen.",
    backgroundDisclosureNotNow: "Niet nu",
    backgroundDisclosureContinue: "Ik begrijp het, doorgaan",
  },
  "ru-RU": {
    title: "Подготовка фоновой поездки",
    hint: "Завершите эти настройки для надёжной GPS-записи при блокировке экрана и напоминаний.",
    notifications: "Уведомления о питании и навигации",
    location: "Точное фоновое местоположение",
    battery: "Без ограничений батареи",
    allowNotifications: "Разрешить уведомления",
    allowLocation: "Разрешить местоположение",
    openSettings: "Открыть настройки",
    allowed: "Разрешено",
    systemSettingRequired: "Завершите этот пункт в системных настройках",
    opening: "Открытие…",
    check: "Проверить",
    batteryNote:
      "Ограничения батареи управляются телефоном. В настройках сделайте это приложение неограниченным или отключите оптимизацию батареи.",
    backgroundDisclosureTitle: "Разрешить фоновое отслеживание поездки?",
    backgroundDisclosurePurpose:
      "Когда вы начинаете поездку, Cycling Assistant требуется фоновое местоположение, чтобы продолжать записывать скорость, расстояние и маршрут при заблокированном экране или работе приложения в фоне.",
    backgroundDisclosureData:
      "• Точное местоположение используется только для записи текущей поездки на этом устройстве.",
    backgroundDisclosureStop:
      "• Фоновое отслеживание прекращается после завершения поездки.",
    backgroundDisclosureSystem:
      "• Далее Android откроет системные настройки разрешения. Вы можете отказаться или изменить выбор позже в настройках.",
    backgroundDisclosureNotNow: "Не сейчас",
    backgroundDisclosureContinue: "Понятно, продолжить",
  },
  "ar-SA": {
    title: "التحضير للركوب في الخلفية",
    hint: "أكمل هذه الإعدادات لتحسين موثوقية GPS والتنبيهات أثناء قفل الشاشة.",
    notifications: "إشعارات التغذية والملاحة",
    location: "الموقع الدقيق في الخلفية",
    battery: "بطارية دون قيود",
    allowNotifications: "السماح بالإشعارات",
    allowLocation: "السماح بالموقع",
    openSettings: "فتح الإعدادات",
    allowed: "مسموح",
    systemSettingRequired: "أكمل هذا العنصر في إعدادات النظام",
    opening: "جارٍ الفتح…",
    check: "تحقق",
    batteryNote:
      "تُدار قيود البطارية بواسطة هاتفك. اجعل هذا التطبيق غير مقيّد في الإعدادات أو عطّل تحسين البطارية.",
    backgroundDisclosureTitle: "السماح بتتبّع الركوب في الخلفية؟",
    backgroundDisclosurePurpose:
      "عند اختيار بدء الركوب، يحتاج مساعد الدراجات إلى الموقع في الخلفية لمتابعة تسجيل السرعة والمسافة والمسار أثناء قفل الشاشة أو عمل التطبيق في الخلفية.",
    backgroundDisclosureData:
      "• يُستخدم موقعك الدقيق فقط لسجل الركوب النشط على هذا الجهاز.",
    backgroundDisclosureStop: "• يتوقف التتبّع في الخلفية عند إنهاء الركوب.",
    backgroundDisclosureSystem:
      "• سيفتح Android بعد ذلك إعداد إذن للنظام. يمكنك الرفض أو تغيير ذلك لاحقًا من الإعدادات.",
    backgroundDisclosureNotNow: "ليس الآن",
    backgroundDisclosureContinue: "أفهم، متابعة",
  },
};
