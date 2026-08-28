/** 僅接受 ISO 日期 YYYY-MM-DD，避免地區格式造成生日解析歧義。 */
export function normalizeBirthday(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return undefined;
  const nowYear = new Date().getFullYear();
  return year >= 1900 && year <= nowYear ? value : undefined;
}

/**
 * 以裝置目前日期計算年齡，故不需要每年重新輸入；未設定生日時回傳 undefined。
 */
export function calculateAgeFromBirthday(birthday: string | undefined, now = new Date()): number | undefined {
  const normalized = normalizeBirthday(birthday);
  if (!normalized) return undefined;
  const [birthYear, birthMonth, birthDay] = normalized.split("-").map(Number);
  const hasHadBirthday = now.getMonth() + 1 > birthMonth
    || (now.getMonth() + 1 === birthMonth && now.getDate() >= birthDay);
  return Math.max(0, now.getFullYear() - birthYear - (hasHadBirthday ? 0 : 1));
}
