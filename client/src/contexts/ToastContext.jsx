import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';

const ToastContext = createContext(null);

const DURATION = { success: 4000, error: 6000, warning: 5000, info: 4000 };

const styles = {
  success: {
    bg:      'bg-green-50 border-green-200 border-l-green-500',
    icon:    <CheckCircleIcon className="w-5 h-5 text-green-600" />,
    text:    'text-green-900',
    dismiss: 'text-green-400 hover:text-green-700',
  },
  error: {
    bg:      'bg-red-50 border-red-200 border-l-red-500',
    icon:    <XCircleIcon className="w-5 h-5 text-red-600" />,
    text:    'text-red-900',
    dismiss: 'text-red-400 hover:text-red-700',
  },
  warning: {
    bg:      'bg-amber-50 border-amber-200 border-l-amber-500',
    icon:    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />,
    text:    'text-amber-900',
    dismiss: 'text-amber-400 hover:text-amber-700',
  },
  info: {
    bg:      'bg-blue-50 border-blue-200 border-l-blue-500',
    icon:    <InformationCircleIcon className="w-5 h-5 text-blue-600" />,
    text:    'text-blue-900',
    dismiss: 'text-blue-400 hover:text-blue-700',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'info', duration) => {
    const id = Date.now() + Math.random();
    const ms = duration ?? DURATION[type] ?? 4000;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ms);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const s = styles[t.type] || styles.info;
          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 rounded-lg shadow-lg border border-l-4 p-4 animate-slide-in-right ${s.bg}`}
            >
              <span className="flex-shrink-0 mt-0.5">{s.icon}</span>
              <p className={`flex-1 text-sm font-medium leading-snug ${s.text}`}>{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className={`flex-shrink-0 -mt-0.5 -mr-1 transition-colors ${s.dismiss}`}
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.toast;
}
