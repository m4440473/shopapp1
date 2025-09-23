"use client";
import React, { createContext, useContext, useState } from 'react';

const ToastContext = createContext<any>(null);

export function ToastProvider({ children }: any) {
  const [toasts, setToasts] = useState<any[]>([]);
  function push(msg: string, level: 'success'|'error'|'info' = 'info') {
    const id = Date.now().toString();
    setToasts(t => [...t, { id, msg, level }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-3 py-2 rounded ${t.level==='success'?'bg-green-600':'bg-red-600'}`}>{t.msg}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext) || { push: ()=>{} }; }
