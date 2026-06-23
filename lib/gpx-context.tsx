/**
 * GPX 共享 Context
 *
 * 讓路線分析頁（navigate.tsx）匯入的 GPX 路線
 * 可以直接在導航頁（map.tsx）中讀取並顯示軌跡圖層。
 */

import React, { createContext, useCallback, useContext, useState } from "react";
import { type GpxRoute, parseGpx } from "@/lib/gpx-parser";

interface GpxContextValue {
  /** 目前載入的 GPX 路線（null 表示尚未匯入） */
  sharedRoute: GpxRoute | null;
  /** 由路線頁呼叫：設定共享路線 */
  setSharedRoute: (route: GpxRoute | null) => void;
  /** 清除共享路線 */
  clearSharedRoute: () => void;
  /** 從最愛路線的 GPX 內容套用 */
  applyFavoriteRoute: (gpxContent: string) => Promise<void>;
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

  const applyFavoriteRoute = useCallback(async (gpxContent: string) => {
    try {
      const route = parseGpx(gpxContent);
      if (route) {
        setSharedRouteState(route);
      } else {
        throw new Error("無法解析 GPX 內容");
      }
    } catch (err) {
      console.error("[GpxContext] 套用最愛路線失敗:", err);
      throw err;
    }
  }, []);

  return (
    <GpxContext.Provider value={{ sharedRoute, setSharedRoute, clearSharedRoute, applyFavoriteRoute }}>
      {children}
    </GpxContext.Provider>
  );
}

export function useGpx() {
  const ctx = useContext(GpxContext);
  if (!ctx) throw new Error("useGpx must be used within GpxProvider");
  return ctx;
}
