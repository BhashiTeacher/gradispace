import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';

const ToastContext = createContext(null);

const icons = {
  success: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
  error:   <XCircleIcon    className="w-5 h-5 text-red-500"   />,
  warning: <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />,
  info:    <InformationCircleIcon   className="w-5 h-5 text-blue-500"  />,
};

const borders = {
  success: 'border-l-green-500',
  error:   'border-l-red-500',
  warning: 'border-l-amber-500',
  info:    'border-l-blue-500',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 bg-white rounded-lg shadow-lg border border-slate-200 border-l-4 ${borders[t.type]} p-4 animate-slide-in-right`}
          >
            <span className="flex-shrink-0 mt-0.5">{icons[t.type]}</span>
            <p className="flex-1 text-sm text-slate-700 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600 -mt-0.5 -mr-1"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.toast;
}
