#!/usr/bin/env python3
"""Prepare privacy-policy localization drafts for attorney review.

This script deliberately labels machine-generated locale content as a draft in
the accompanying legal-review brief. It preserves the Local-First factual
claims and only writes a locale after every privacy section has passed a schema
check. Run `--seed` first, then `--translate` for the remaining locales.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlencode
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
LOCALES_DIR = ROOT / "lib" / "i18n" / "locales"
MODEL = os.environ.get("PRIVACY_TRANSLATION_MODEL", "gpt-5-mini")
TRANSLATION_PROVIDER = os.environ.get("PRIVACY_TRANSLATION_PROVIDER", "model")

TARGETS = {
    "zh-CN": "Simplified Chinese (Mainland China)",
    "ja-JP": "Japanese (Japan)",
    "ko-KR": "Korean (South Korea)",
    "es-ES": "Spanish (Spain)",
    "pt-BR": "Portuguese (Brazil)",
    "fr-FR": "French (France)",
    "de-DE": "German (Germany)",
    "it-IT": "Italian (Italy)",
    "nl-NL": "Dutch (Netherlands)",
    "ru-RU": "Russian (Russia)",
    "ar-SA": "Arabic (Saudi Arabia), use modern standard Arabic",
}

SECTION_ORDER = [
    "introduction",
    "collection",
    "use",
    "storage",
    "sharing",
    "rights",
    "children",
    "locationPermissions",
    "notificationPermissions",
    "security",
    "changes",
    "contact",
]

ENGLISH_SECTIONS = {
    "introduction": {
        "title": "1. Introduction",
        "body": "Bike Assistant uses a Local-First design. This policy explains how the App processes, stores, and deletes data on your device. The App does not provide accounts, social features, friends, cloud synchronization, or remote push-notification services.",
    },
    "collection": {
        "title": "2. Data we collect",
        "body": "The App processes the following data only on your device:\n\n[Location and route data]\n• GPS location, elevation, speed, and direction of travel\n• Ride tracks and imported GPX routes\n\nPurpose: current-location display, offline ride records, background tracking, route preview, and navigation.\n\n[Personal and activity data]\n• Date of birth, height, weight, and locally estimated physiological metrics\n• Ride duration, distance, elevation gain, power, calories, and supply estimates\n• Photos, videos, and ride notes that you choose to attach\n\nPurpose: local activity analysis, supply reminders, and personalized estimates. The App does not create accounts or collect email, contacts, or friend data.",
    },
    "use": {
        "title": "3. How data is used",
        "body": "Data is used only for on-device GPS navigation, ride recording, power and expenditure estimates, supply reminders, activity analysis, and GPX export. Ride notifications are local notifications; the App does not register for or receive remote push notifications.",
    },
    "storage": {
        "title": "4. Storage and retention",
        "body": "Ride records, GPX files, settings, media, and crash-recovery snapshots are stored on your device. Data is retained until you delete activities, clear the cache, or uninstall the App. The App does not automatically upload or synchronize this data across devices.",
    },
    "sharing": {
        "title": "5. Data sharing",
        "body": "The App has no friend location sharing, social features, or cloud database. You may voluntarily export GPX files, activity cards, or media through the Android system share sheet; you decide both the recipient and the content.\n\nIf you actively use online routing or weather information while connected to the internet, the App may send coordinates needed for route calculation to public map or routing services. These services are not account, tracking, or synchronization mechanisms, and offline features do not depend on them.",
    },
    "rights": {
        "title": "6. Your choices and rights",
        "body": "You can edit personal information, delete activities and media, and export your data as GPX files or activity share cards directly in the App. You can also revoke location, notification, photo, or media permissions at any time in device settings. Because the App stores no accounts or cloud copies, there is no account-deletion or server-data-deletion process.",
    },
    "children": {
        "title": "7. Children's privacy",
        "body": "This App is not designed for children under 13, and we do not knowingly collect children's personal information. If you become aware that a child is using this App, please contact us.",
    },
    "locationPermissions": {
        "title": "8. Location permission information",
        "body": "The App uses the following location-related permissions:\n\n• ACCESS_FINE_LOCATION (precise location): accurate GPS navigation and speed calculation\n• ACCESS_COARSE_LOCATION (approximate location): a fallback for precise location\n• ACCESS_BACKGROUND_LOCATION (background location): continued route tracking while the screen is off during a ride, and updates to the foreground notification with speed and distance\n• FOREGROUND_SERVICE (foreground service): shows the persistent ride notification and helps prevent Android from interrupting GPS tracking\n\nBackground location is enabled only after you actively start a ride. You can pause or stop a ride at any time to end background tracking.",
    },
    "notificationPermissions": {
        "title": "9. Notification permission information",
        "body": "• POST_NOTIFICATIONS (notifications): displays ride speed, distance, and time information, together with supply reminder notifications\n\nYou can manage notification permission in device settings.",
    },
    "security": {
        "title": "10. Data security",
        "body": "The App stores data in the application's private storage on your device and reads location, photos, or files only after you grant permission. To protect your data, use a screen lock on your device and review the content before sharing an activity, media, or GPX file.",
    },
    "changes": {
        "title": "11. Changes to this policy",
        "body": "We may update this privacy policy from time to time. For material changes, we will notify you through the App. Your continued use of the App indicates acceptance of the updated policy.",
    },
    "contact": {
        "title": "12. Contact us",
        "body": "If you have questions about this privacy policy or need to exercise your data rights, contact us through the developer contact option in Google Play.\n\nThis policy applies to all versions of the Bike Assistant Android application.",
    },
}

TRADITIONAL_CHINESE_SECTIONS = {
    "introduction": {"title": "1. 前言", "body": "智慧單車騎乘助手採 Local-First 設計。本政策說明 App 在您的裝置上處理、保存與刪除資料的方式。App 不提供帳號、社群、好友、雲端同步或遠端推播服務。"},
    "collection": {"title": "2. 我們收集的資料", "body": "App 僅在裝置上處理下列資料：\n\n【位置與路線資料】\n• GPS 位置、海拔、速度與行進方向\n• 騎乘軌跡與已匯入的 GPX 路線\n\n用途：目前位置顯示、離線騎乘紀錄、背景追蹤、路線預覽與導航。\n\n【個人與活動資料】\n• 生日、身高、體重及本機推定的生理指標\n• 騎乘時間、距離、爬升、功率、卡路里與補給估算\n• 使用者主動附加的相片、影片與活動備註\n\n用途：產生本機活動分析、補給提醒與個人化估算。App 不建立帳號，也不收集電子郵件、聯絡人或好友資料。"},
    "use": {"title": "3. 資料的使用方式", "body": "資料僅用於裝置內的 GPS 導航、騎乘紀錄、功率與消耗估算、補給提醒、活動分析及 GPX 匯出。騎乘中的通知為本機通知，不會註冊或接收遠端推播。"},
    "storage": {"title": "4. 資料的儲存與保留", "body": "騎乘紀錄、GPX 檔案、設定、媒體與崩潰恢復快照皆儲存於您的裝置。資料會保留至您在 App 內刪除活動、清除快取或解除安裝 App 為止。App 不會自動上傳或跨裝置同步這些資料。"},
    "sharing": {"title": "5. 資料的分享", "body": "App 沒有好友位置共享、社群功能或雲端資料庫。您可透過 Android 系統分享功能主動匯出 GPX、活動卡片或媒體；分享對象與內容完全由您決定。\n\n若您主動在有網路時使用線上路徑或天氣資訊，App 可能會將路徑計算所需的座標傳送至公開地圖或路徑服務。這些服務不是帳號、追蹤或同步機制；離線功能不依賴它們。"},
    "rights": {"title": "6. 您的權利", "body": "您可直接在 App 內編輯個人資料、刪除活動與媒體，並以 GPX 或活動分享卡匯出自己的資料。您也可以隨時在裝置設定中撤銷位置、通知、相片或媒體權限。由於 App 不保存帳號或雲端副本，沒有帳號刪除或伺服器資料刪除程序。"},
    "children": {"title": "7. 兒童隱私", "body": "本應用程式不針對 13 歲以下兒童設計，我們不會故意收集兒童的個人資料。若您發現有兒童使用本應用程式，請聯絡我們。"},
    "locationPermissions": {"title": "8. 位置權限說明", "body": "本應用程式需要以下位置相關權限：\n\n• ACCESS_FINE_LOCATION（精確位置）：提供準確的 GPS 導航與速度計算\n• ACCESS_COARSE_LOCATION（概略位置）：作為精確位置的備用\n• ACCESS_BACKGROUND_LOCATION（背景位置）：騎乘中螢幕關閉時持續追蹤路線，並更新前台通知欄的速度與距離資訊\n• FOREGROUND_SERVICE（前台服務）：顯示騎乘中的持續通知，確保 GPS 追蹤不被系統中斷\n\n背景位置僅在您主動開始騎乘後才會啟用，您可隨時暫停或停止騎乘以終止背景追蹤。"},
    "notificationPermissions": {"title": "9. 通知權限說明", "body": "• POST_NOTIFICATIONS（推播通知）：用於顯示騎乘中的速度、距離、時間資訊，以及補給提醒通知\n\n您可在裝置設定中管理通知權限。"},
    "security": {"title": "10. 資料安全", "body": "App 將資料保存於裝置的應用程式私有儲存空間，並只在您授權後讀取定位、相片或檔案。為保護資料，請為裝置設定螢幕鎖定，並在分享活動、媒體或 GPX 前確認分享內容。"},
    "changes": {"title": "11. 政策變更", "body": "我們可能不定期更新本隱私政策。重大變更時，我們將透過應用程式通知您。繼續使用本應用程式即表示您接受更新後的政策。"},
    "contact": {"title": "12. 聯絡我們", "body": "若您對本隱私政策有任何疑問，或需要行使您的資料權利，請透過 Google Play 商店的開發者聯絡功能與我們聯繫。\n\n本政策適用於智慧單車騎乘助手 Android 應用程式的所有版本。"},
}

MANUAL_REVIEW_DRAFT_OVERRIDES = {
    "ja-JP": {
        "collection": {
            "title": "2. 収集するデータ",
            "body": "アプリは次のデータを端末上でのみ処理します：\n\n【位置情報とルートデータ】\n• GPS位置、標高、速度、進行方向\n• 走行軌跡とインポートしたGPXルート\n\n目的：現在地の表示、オフライン走行記録、バックグラウンド追跡、ルートのプレビューおよびナビゲーション。\n\n【個人情報とアクティビティデータ】\n• 生年月日、身長、体重、端末内で推定した生理指標\n• 走行時間、距離、獲得標高、パワー、カロリー、補給推定\n• ユーザーが自ら添付した写真、動画、アクティビティメモ\n\n目的：端末内でのアクティビティ分析、補給リマインダー、個別推定。アプリはアカウントを作成せず、メールアドレス、連絡先、友達データを収集しません。",
        },
        "sharing": {
            "title": "5. データの共有",
            "body": "アプリには友達との位置共有、ソーシャル機能、クラウドデータベースはありません。Android のシステム共有機能を使用して、GPX、アクティビティカード、メディアを自発的にエクスポートできます。共有先と共有内容はすべてユーザーが決定します。\n\nネットワーク接続中にオンラインのルーティングまたは天気情報を積極的に使用した場合、アプリはルート計算に必要な座標を公開地図またはルーティングサービスに送信することがあります。これらのサービスはアカウント、追跡、同期の仕組みではなく、オフライン機能もそれらに依存しません。",
        },
        "locationPermissions": {
            "title": "8. 位置情報権限について",
            "body": "アプリは以下の位置情報関連権限を使用します：\n\n• ACCESS_FINE_LOCATION（正確な位置情報）：正確なGPSナビゲーションと速度計算\n• ACCESS_COARSE_LOCATION（おおよその位置情報）：正確な位置情報の代替\n• ACCESS_BACKGROUND_LOCATION（バックグラウンド位置情報）：走行中に画面がオフでもルート追跡を継続し、速度と距離を前景通知に更新\n• FOREGROUND_SERVICE（前景サービス）：走行中の継続通知を表示し、Android によるGPS追跡の中断を防止\n\nバックグラウンド位置情報は、ユーザーが走行を開始した後にのみ有効になります。バックグラウンド追跡を終了するにはいつでも走行を一時停止または停止できます。",
        },
    },
    "ko-KR": {
        "collection": {
            "title": "2. 수집하는 데이터",
            "body": "앱은 다음 데이터를 기기에서만 처리합니다:\n\n[위치 및 경로 데이터]\n• GPS 위치, 고도, 속도 및 이동 방향\n• 주행 궤적과 가져온 GPX 경로\n\n용도: 현재 위치 표시, 오프라인 주행 기록, 백그라운드 추적, 경로 미리보기 및 내비게이션.\n\n[개인 및 활동 데이터]\n• 생년월일, 키, 체중 및 기기 내 추정 생리 지표\n• 주행 시간, 거리, 누적 상승, 파워, 칼로리 및 보급 추정치\n• 사용자가 직접 첨부한 사진, 동영상 및 활동 메모\n\n용도: 기기 내 활동 분석, 보급 알림 및 개인화 추정. 앱은 계정을 만들거나 이메일, 연락처 또는 친구 데이터를 수집하지 않습니다.",
        },
        "sharing": {
            "title": "5. 데이터 공유",
            "body": "앱에는 친구 위치 공유, 소셜 기능 또는 클라우드 데이터베이스가 없습니다. Android 시스템 공유 기능을 통해 GPX, 활동 카드 또는 미디어를 자발적으로 내보낼 수 있으며, 공유 대상과 내용은 사용자가 전적으로 결정합니다.\n\n인터넷 연결 상태에서 온라인 경로 또는 날씨 정보를 직접 사용하면, 앱은 경로 계산에 필요한 좌표를 공개 지도 또는 경로 서비스에 전송할 수 있습니다. 이러한 서비스는 계정, 추적 또는 동기화 메커니즘이 아니며 오프라인 기능은 이에 의존하지 않습니다.",
        },
        "locationPermissions": {
            "title": "8. 위치 권한 안내",
            "body": "앱은 다음 위치 관련 권한을 사용합니다:\n\n• ACCESS_FINE_LOCATION(정확한 위치): 정확한 GPS 내비게이션 및 속도 계산\n• ACCESS_COARSE_LOCATION(대략적 위치): 정확한 위치의 대체 수단\n• ACCESS_BACKGROUND_LOCATION(백그라운드 위치): 주행 중 화면이 꺼져도 경로 추적을 계속하고, 속도와 거리를 포그라운드 알림에 업데이트\n• FOREGROUND_SERVICE(포그라운드 서비스): 지속적인 주행 알림을 표시하고 Android가 GPS 추적을 중단하지 않도록 지원\n\n백그라운드 위치는 사용자가 직접 주행을 시작한 후에만 활성화됩니다. 언제든지 주행을 일시 정지하거나 종료하여 백그라운드 추적을 끝낼 수 있습니다.",
        },
    },
    "ar-SA": {
        "collection": {
            "title": "2. البيانات التي نجمعها",
            "body": "يعالج التطبيق البيانات التالية على جهازك فقط:\n\n[بيانات الموقع والمسار]\n• موقع GPS والارتفاع والسرعة واتجاه الحركة\n• مسارات الركوب ومسارات GPX المستوردة\n\nالغرض: عرض الموقع الحالي وسجلات الركوب دون اتصال والتتبع في الخلفية ومعاينة المسار والملاحة.\n\n[البيانات الشخصية وبيانات النشاط]\n• تاريخ الميلاد والطول والوزن والمؤشرات الفسيولوجية المقدرة محلياً\n• مدة الركوب والمسافة وإجمالي الصعود والقدرة والسعرات وتقديرات الإمداد\n• الصور ومقاطع الفيديو وملاحظات النشاط التي يضيفها المستخدم بنفسه\n\nالغرض: تحليل النشاط محلياً وتذكيرات الإمداد والتقديرات المخصصة. لا ينشئ التطبيق حسابات ولا يجمع البريد الإلكتروني أو جهات الاتصال أو بيانات الأصدقاء.",
        },
        "sharing": {
            "title": "5. مشاركة البيانات",
            "body": "لا يحتوي التطبيق على مشاركة موقع مع الأصدقاء أو ميزات اجتماعية أو قاعدة بيانات سحابية. يمكنك تصدير ملفات GPX أو بطاقات النشاط أو الوسائط طوعاً عبر ميزة مشاركة النظام في Android؛ وتحدد أنت المستلم والمحتوى بالكامل.\n\nإذا استخدمت معلومات المسار أو الطقس عبر الإنترنت بشكل نشط أثناء الاتصال بالشبكة، فقد يرسل التطبيق الإحداثيات اللازمة لحساب المسار إلى خدمات خرائط أو مسارات عامة. هذه الخدمات ليست آليات للحسابات أو التتبع أو المزامنة، ولا تعتمد عليها الميزات دون اتصال.",
        },
        "locationPermissions": {
            "title": "8. معلومات أذونات الموقع",
            "body": "يستخدم التطبيق أذونات الموقع التالية:\n\n• ACCESS_FINE_LOCATION (الموقع الدقيق): ملاحة GPS دقيقة وحساب السرعة\n• ACCESS_COARSE_LOCATION (الموقع التقريبي): بديل للموقع الدقيق\n• ACCESS_BACKGROUND_LOCATION (الموقع في الخلفية): استمرار تتبع المسار عند إيقاف الشاشة أثناء الركوب وتحديث إشعار المقدمة بالسرعة والمسافة\n• FOREGROUND_SERVICE (خدمة المقدمة): عرض إشعار الركوب المستمر والمساعدة على منع Android من إيقاف تتبع GPS\n\nلا يُفعّل الموقع في الخلفية إلا بعد أن تبدأ ركوباً بنفسك. يمكنك إيقاف الركوب مؤقتاً أو إنهاءه في أي وقت لإيقاف التتبع في الخلفية.",
        },
    },
}


def load_locale(locale: str) -> dict[str, Any]:
    return json.loads((LOCALES_DIR / f"{locale}.json").read_text(encoding="utf-8"))


def save_locale(locale: str, payload: dict[str, Any]) -> None:
    (LOCALES_DIR / f"{locale}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def validate_sections(value: Any, expected: list[str]) -> dict[str, dict[str, str]]:
    if not isinstance(value, dict):
        raise ValueError("translation is not an object")
    output: dict[str, dict[str, str]] = {}
    for section in expected:
        candidate = value.get(section)
        if not isinstance(candidate, dict):
            raise ValueError(f"missing section: {section}")
        title = candidate.get("title")
        body = candidate.get("body")
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f"invalid title: {section}")
        if not isinstance(body, str) or not body.strip():
            raise ValueError(f"invalid body: {section}")
        output[section] = {"title": title.strip(), "body": body.strip()}
    return output


def translate_text_with_mymemory(locale: str, text: str) -> str:
    """Translate public policy text while preserving platform/API identifiers."""
    if len(text) > 450:
        chunks: list[str] = []
        remaining = text
        while len(remaining) > 450:
            split_at = max(
                remaining.rfind("\n\n", 0, 450),
                remaining.rfind(". ", 0, 450),
                remaining.rfind("。", 0, 450),
                remaining.rfind("\n", 0, 450),
                remaining.rfind(" ", 0, 450),
            )
            if split_at <= 0:
                split_at = 450
            separator_end = split_at + (2 if remaining[split_at:split_at + 2] == ". " else 1)
            chunks.append(remaining[:separator_end])
            remaining = remaining[separator_end:]
        chunks.append(remaining)
        return "".join(translate_text_with_mymemory(locale, chunk) for chunk in chunks)
    protected = text
    protected_tokens: list[tuple[str, str]] = []
    for index, identifier in enumerate(
        [
            "ACCESS_FINE_LOCATION",
            "ACCESS_COARSE_LOCATION",
            "ACCESS_BACKGROUND_LOCATION",
            "FOREGROUND_SERVICE",
            "POST_NOTIFICATIONS",
            "Local-First",
            "Google Play",
            "Android",
            "GPX",
            "GPS",
            "App",
        ]
    ):
        token = f"PRIVACYTOKEN{index}"
        if identifier in protected:
            protected = protected.replace(identifier, token)
            protected_tokens.append((token, identifier))
    language = locale.split("-", maxsplit=1)[0]
    params = urlencode({"q": protected, "langpair": f"en|{language}"})
    request = urllib.request.Request(
        f"https://api.mymemory.translated.net/get?{params}",
        headers={"User-Agent": "BikeAssistantPrivacyDraft/1.0"},
    )
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
            translated = str(payload["responseData"]["translatedText"]).strip()
            if not translated or "QUERY LENGTH LIMIT EXCEEDED" in translated.upper():
                raise ValueError("empty MyMemory translation")
            for token, identifier in protected_tokens:
                translated = translated.replace(token, identifier)
            if any(token in translated for token, _ in protected_tokens):
                raise ValueError("unrestored protected identifier")
            return translated
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError, ValueError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(2**attempt)
    raise RuntimeError(f"MyMemory translation failed: {last_error}")


def translate_batch_with_mymemory(locale: str, batch: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for key, section in batch.items():
        result[key] = {
            "title": translate_text_with_mymemory(locale, section["title"]),
            "body": translate_text_with_mymemory(locale, section["body"]),
        }
        time.sleep(0.6)
    return validate_sections(result, list(batch))


def invoke_translation(target_language: str, batch: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    if TRANSLATION_PROVIDER == "mymemory":
        locale = next(locale for locale, name in TARGETS.items() if name == target_language)
        return translate_batch_with_mymemory(locale, batch)
    api_base = os.environ.get("OPENAI_API_BASE")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_base or not api_key:
        raise RuntimeError("OPENAI_API_BASE and OPENAI_API_KEY are required")
    prompt = (
        "Translate this Android app privacy-policy draft into "
        f"{target_language}. Preserve factual scope exactly; do not add legal claims, "
        "jurisdictions, promises, or obligations. Keep identifiers such as GPX, GPS, "
        "ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, ACCESS_BACKGROUND_LOCATION, "
        "FOREGROUND_SERVICE, and POST_NOTIFICATIONS unchanged. Preserve newlines and "
        "bullet points. Return JSON only, matching the exact input section keys and "
        "the title/body object shape.\n\n"
        + json.dumps(batch, ensure_ascii=False)
    )
    request_payload: dict[str, Any] = {
        "model": MODEL,
        "temperature": 0.1,
        "messages": [
            {
                "role": "system",
                "content": "You are a precise professional legal-policy translator. Output JSON only.",
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }
    if MODEL.startswith("claude-") or MODEL.startswith("gemini-"):
        request_payload["max_tokens"] = 3600
    else:
        request_payload["max_completion_tokens"] = 3600
    request_data = json.dumps(request_payload).encode("utf-8")
    request = urllib.request.Request(
        api_base.rstrip("/") + "/chat/completions",
        data=request_data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                data = json.loads(response.read().decode("utf-8"))
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            if not isinstance(content, str) or not content.strip():
                choice = data.get("choices", [{}])[0]
                raise ValueError(
                    "empty model response: "
                    + json.dumps(
                        {
                            "finish_reason": choice.get("finish_reason"),
                            "message": choice.get("message"),
                            "error": data.get("error"),
                        },
                        ensure_ascii=False,
                    )
                )
            return validate_sections(json.loads(content), list(batch))
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, json.JSONDecodeError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(2**attempt)
    raise RuntimeError(f"translation failed after retries: {last_error}")


def seed() -> None:
    for locale, sections in (("en-US", ENGLISH_SECTIONS), ("zh-TW", TRADITIONAL_CHINESE_SECTIONS)):
        resource = load_locale(locale)
        resource["privacy"] = {"sections": sections}
        save_locale(locale, resource)
        print(f"seeded {locale}")


def translate(locales: list[str]) -> None:
    for locale in locales:
        if locale not in TARGETS:
            raise ValueError(f"unsupported translation target: {locale}")
        resource = load_locale(locale)
        translated: dict[str, dict[str, str]] = {}
        for offset in range(0, len(SECTION_ORDER), 2):
            keys = SECTION_ORDER[offset : offset + 2]
            batch = {key: ENGLISH_SECTIONS[key] for key in keys}
            print(f"translating {locale}: {', '.join(keys)}", flush=True)
            translated.update(invoke_translation(TARGETS[locale], batch))
        resource["privacy"] = {"sections": validate_sections(translated, SECTION_ORDER)}
        save_locale(locale, resource)
        print(f"wrote {locale}")


def repair_target_drafts() -> None:
    for locale, overrides in MANUAL_REVIEW_DRAFT_OVERRIDES.items():
        resource = load_locale(locale)
        sections = resource.get("privacy", {}).get("sections")
        if not isinstance(sections, dict):
            raise ValueError(f"{locale} is missing privacy sections")
        sections.update(overrides)
        resource["privacy"] = {"sections": validate_sections(sections, SECTION_ORDER)}
        save_locale(locale, resource)
        print(f"repaired {locale}")


def clean_invalid_drafts() -> None:
    for path in sorted(LOCALES_DIR.glob("*.json")):
        resource = json.loads(path.read_text(encoding="utf-8"))
        sections = resource.get("privacy", {}).get("sections")
        if not isinstance(sections, dict):
            continue
        serialized = json.dumps(sections, ensure_ascii=False).upper()
        if "QUERY LENGTH LIMIT EXCEEDED" not in serialized:
            continue
        resource.pop("privacy", None)
        path.write_text(
            json.dumps(resource, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"removed invalid privacy draft: {path.stem}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", action="store_true")
    parser.add_argument("--translate", action="store_true")
    parser.add_argument("--repair-target-drafts", action="store_true")
    parser.add_argument("--clean-invalid-drafts", action="store_true")
    parser.add_argument("--locales", nargs="*", default=list(TARGETS))
    args = parser.parse_args()
    if not args.seed and not args.translate and not args.repair_target_drafts and not args.clean_invalid_drafts:
        parser.error("select --seed, --translate, --repair-target-drafts, and/or --clean-invalid-drafts")
    if args.seed:
        seed()
    if args.translate:
        translate(args.locales)
    if args.repair_target_drafts:
        repair_target_drafts()
    if args.clean_invalid_drafts:
        clean_invalid_drafts()
    return 0


if __name__ == "__main__":
    sys.exit(main())
