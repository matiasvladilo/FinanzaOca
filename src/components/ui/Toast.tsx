'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, X, AlertCircle, Info } from 'lucide-react';
import clsx from 'clsx';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let addToastFn: ((msg: string, type?: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = 'success') {
  addToastFn?.(message, type);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    addToastFn = (message, type = 'success') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };
    return () => { addToastFn = null; };
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-[13px] font-medium pointer-events-auto',
            'animate-in slide-in-from-right-4 duration-200',
            t.type === 'success' ? 'bg-gray-900 text-white' :
            t.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          )}
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
          {t.type === 'error'   && <AlertCircle  className="w-4 h-4 text-red-200  flex-shrink-0" />}
          {t.type === 'info'    && <Info          className="w-4 h-4 text-blue-200 flex-shrink-0" />}
          <span>{t.message}</span>
          <button onClick={() => remove(t.id)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
