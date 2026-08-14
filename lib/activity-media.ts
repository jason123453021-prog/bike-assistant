/**
 * 從目前仍可用的本機照片中解析活動封面。
 * 封面只保存 URI，不另外複製檔案；若來源已移除，畫面安全回退為路線視覺。
 */
export function resolveActivityCoverPhotoUri(
  preferredUri: string | undefined,
  availableUris: readonly string[],
): string | undefined {
  const trimmed = preferredUri?.trim();
  return trimmed && availableUris.includes(trimmed) ? trimmed : undefined;
}
