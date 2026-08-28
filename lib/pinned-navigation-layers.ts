export interface PinnedNavigationLayer<T> {
  id: string;
  route: T;
}

/** 回傳新釘選導航前是否必須向使用者確認既有圖層處理方式。 */
export function hasExistingNavigationLayers(
  hasImportedGpx: boolean,
  pinnedLayerCount: number,
): boolean {
  return hasImportedGpx || pinnedLayerCount > 0;
}

/** 依使用者的清除選擇建立下一個釘選導航圖層集合。 */
export function applyPinnedNavigationDecision<T>(
  existingLayers: PinnedNavigationLayer<T>[],
  nextLayer: PinnedNavigationLayer<T>,
  clearExisting: boolean,
): PinnedNavigationLayer<T>[] {
  return clearExisting ? [nextLayer] : [...existingLayers, nextLayer];
}
