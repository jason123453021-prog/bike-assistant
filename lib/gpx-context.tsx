/**
 * GPX 共享 Context
 *
 * 讓路線分析頁（navigate.tsx）匯入的 GPX 路線
 * 可以直接在導航頁（map.tsx）中讀取並顯示軌跡圖層。
 */

import React, { createContext, useCallback, useContext, useState } from "react";
import { type GpxRoute } from "@/lib/gpx-parser";
import { importExternalGpxUri } from "@/lib/external-gpx-import";

interface GpxContextValue {
  /** 目前載入的 GPX 路線（null 表示尚未匯入） */
  sharedRoute: GpxRoute | null;
  /** 由路線頁呼叫：設定共享路線 */
  setSharedRoute: (route: GpxRoute | null) => void;
  /** 清除共享路線 */
  clearSharedRoute: () => void;
  /** 從系統「開啟方式」或檔案選取器 URI 匯入；全程只在裝置端讀取。 */
  importExternalRoute: (uri: string, declaredSize?: number) => Promise<GpxRoute>;
}

const GpxContext = createContext<GpxContextValue | null>(null);

export function GpxProvider({ children }: { children: React.ReactNode }) {
  const [sharedRoute, setSharedRouteState] = useState<GpxRoute | null>(null);

  const setSharedRoute = useCallback((route: GpxRoute | null) => {
    setSharedRouteState(route);
  }, []);

  const clearSharedRoute = useCallback(() => {
    setSharedRouteState(null);
  }, []);

  const importExternalRoute = useCallback(async (uri: string, declaredSize?: number) => {
    const route = await importExternalGpxUri(uri, declaredSize);
    setSharedRouteState(route);
    return route;
  }, []);

  return (
    <GpxContext.Provider value={{ sharedRoute, setSharedRoute, clearSharedRoute, importExternalRoute }}>
      {children}
    </GpxContext.Provider>
  );
}

export function useGpx() {
  const ctx = useContext(GpxContext);
  if (!ctx) throw new Error("useGpx must be used within GpxProvider");
  return ctx;
}
