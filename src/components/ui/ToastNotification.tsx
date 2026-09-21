import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastNotificationBanner: React.FC = () => {
  const { toast, clearToast } = useUIStore();
  if (!toast) return null;

  const bgStyles = {
    success: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50 shadow-xl',
    error: 'bg-rose-950/95 border-rose-500/40 text-rose-200 shadow-rose-950/50 shadow-xl',
    info: 'bg-zinc-900/95 border-zinc-700 text-zinc-200 shadow-black/50 shadow-xl',
  }[toast.type];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto max-w-[90vw] sm:max-w-md">
      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-md text-xs sm:text-sm font-medium ${bgStyles}`}>
        {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
        {toast.type === 'info' && <Info className="w-4 h-4 text-zinc-400 shrink-0" />}
        <span className="flex-1 truncate">{toast.message}</span>
        <button 
          onClick={clearToast} 
          className="p-1 hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white shrink-0 ml-1"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
