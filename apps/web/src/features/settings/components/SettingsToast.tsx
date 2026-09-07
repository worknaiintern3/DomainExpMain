import React from 'react';

export interface ToastData {
  message: string;
  description?: string;
  type?: 'success' | 'info' | 'error';
}

interface SettingsToastProps {
  toast: ToastData | null;
  onDismiss: () => void;
}

export const SettingsToast: React.FC<SettingsToastProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="flex items-center gap-unit-sm px-unit-base py-unit-sm rounded-xl bg-inverse-surface text-inverse-on-surface shadow-2xl border border-outline/20">
        <span
          className={`material-symbols-outlined text-[20px] shrink-0 ${
            isError ? 'text-error' : 'text-emerald-400'
          }`}
        >
          {isError ? 'error' : 'check_circle'}
        </span>
        <div className="flex flex-col min-w-0 pr-2">
          <span className="font-label-md text-label-md font-semibold text-inverse-on-surface truncate">
            {toast.message}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary-fixed-dim truncate">
            {toast.description || 'Preferences updated in local demo session'}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto w-6 h-6 rounded flex items-center justify-center text-secondary-fixed-dim hover:text-white transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};
