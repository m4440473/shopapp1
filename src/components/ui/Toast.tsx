"use client";
import React, { createContext, useContext, useState } from 'react';

interface ToastItem {
  id: string;
  msg: string;
  level: 'success' | 'error' | 'info';
}

const ToastContext = createContext<{ push: (msg: string, level?: ToastItem['level']) => void } | null>(null);

const levelStyles: Record<ToastItem['level'], string> = {
  success: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-100',
  error: 'border-red-400/60 bg-red-400/10 text-red-100',
  info: 'border-blue-400/60 bg-blue-400/10 text-blue-100',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function push(msg: string, level: ToastItem['level'] = 'info') {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, msg, level }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000);
  }

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur ${levelStyles[toast.level]}`}
          >
            {toast.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) ?? { push: () => {} };
}
