import AsyncStorage from "@react-native-async-storage/async-storage";

/** 僅記錄使用者已讀取 app 內顯眼告知；系統位置授權仍完全由 Android/iOS 管理。 */
export const BACKGROUND_LOCATION_DISCLOSURE_STORAGE_KEY =
  "@bike_assistant/background_location_disclosure_v1";

export async function hasAcceptedBackgroundLocationDisclosure(): Promise<boolean> {
  try {
    return (
      (await AsyncStorage.getItem(
        BACKGROUND_LOCATION_DISCLOSURE_STORAGE_KEY,
      )) === "accepted"
    );
  } catch {
    // 無法讀取本機狀態時採安全預設：再次向使用者顯示告知，而不是略過。
    return false;
  }
}

export async function recordBackgroundLocationDisclosureAcceptance(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      BACKGROUND_LOCATION_DISCLOSURE_STORAGE_KEY,
      "accepted",
    );
  } catch {
    // 寫入失敗時不阻擋本次明確同意，但下一次仍會再次顯示告知。
  }
}
