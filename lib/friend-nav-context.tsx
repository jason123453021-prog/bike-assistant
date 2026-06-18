/**
 * FriendNavContext
 * 跨頁面傳遞好友導航目的地：friends.tsx 設定後，map.tsx 監聽並啟動導航
 */
import React, { createContext, useCallback, useContext, useState } from "react";

export interface FriendNavRequest {
  friendName: string;
  lat: number;
  lon: number;
  preferCycleway: boolean;
}

interface FriendNavContextValue {
  pendingNav: FriendNavRequest | null;
  requestFriendNav: (req: FriendNavRequest) => void;
  clearFriendNav: () => void;
}

const FriendNavContext = createContext<FriendNavContextValue | null>(null);

export function FriendNavProvider({ children }: { children: React.ReactNode }) {
  const [pendingNav, setPendingNav] = useState<FriendNavRequest | null>(null);

  const requestFriendNav = useCallback((req: FriendNavRequest) => {
    setPendingNav(req);
  }, []);

  const clearFriendNav = useCallback(() => {
    setPendingNav(null);
  }, []);

  return (
    <FriendNavContext.Provider value={{ pendingNav, requestFriendNav, clearFriendNav }}>
      {children}
    </FriendNavContext.Provider>
  );
}

export function useFriendNav() {
  const ctx = useContext(FriendNavContext);
  if (!ctx) throw new Error("useFriendNav must be used within FriendNavProvider");
  return ctx;
}
