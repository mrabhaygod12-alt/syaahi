"use client";
import { createContext, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  msg: string;
  err?: boolean;
}
const ToastCtx = createContext<(msg: string, err?: boolean) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

let nextId = 1;

// Replaces blocking alert() calls with non-blocking toasts.
export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, err = false) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, msg, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.err ? " err" : ""}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
