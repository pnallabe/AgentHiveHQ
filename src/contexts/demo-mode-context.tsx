"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "agentHive_demoMode";

interface DemoModeContextType {
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
  toggleDemoMode: () => void;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(
  undefined
);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setDemoModeState(stored === "true");
      }
    } catch {
      // localStorage not available (SSR or privacy mode) — use default
    }
    setHydrated(true);
  }, []);

  const setDemoMode = (value: boolean) => {
    setDemoModeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore write errors
    }
  };

  const toggleDemoMode = () => setDemoMode(!demoMode);

  // Prevent rendering children with wrong initial state on first paint
  if (!hydrated) return null;

  return (
    <DemoModeContext.Provider value={{ demoMode, setDemoMode, toggleDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode(): DemoModeContextType {
  const ctx = useContext(DemoModeContext);
  if (!ctx) {
    throw new Error("useDemoMode must be used inside <DemoModeProvider>");
  }
  return ctx;
}
