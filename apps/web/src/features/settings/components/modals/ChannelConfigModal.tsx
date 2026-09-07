import React, { useState } from 'react';

interface ChannelConfigModalProps {
  isOpen: boolean;
  channel: 'email' | 'whatsapp';
  onClose: () => void;
  onSave: (addressOrPhone: string) => void;
}

export const ChannelConfigModal: React.FC<ChannelConfigModalProps> = ({
  isOpen,
  channel,
  onClose,
  onSave,
}) => {
  const [value, setValue] = useState(
    channel === 'email' ? 'aman.developer@example.com' : '+91 98765 43210'
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-unit-lg shadow-2xl border border-outline-variant/40 flex flex-col gap-unit-md scale-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-unit-xs border-b border-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">
                {channel === 'email' ? 'mail' : 'chat'}
              </span>
            </div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Configure {channel === 'email' ? 'Email Dispatch' : 'WhatsApp Dispatch'}
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-label-md text-label-md text-on-surface font-medium">
            {channel === 'email' ? 'Destination Email Address' : 'Destination WhatsApp Number'}
          </label>
          <input
            type={channel === 'email' ? 'email' : 'tel'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro"
          />
          <span className="font-caption-xs text-caption-xs text-secondary">
            Stored demo preference for notification routing.
          </span>
        </div>

        {/* Disclosure Box */}
        <div className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0 mt-0.5">
            info
          </span>
          <p className="font-caption-xs text-caption-xs text-secondary leading-normal">
            <strong>Configuration Only (Not Connected):</strong> Channel credentials and destination addresses are stored as frontend preferences. External delivery requires a connected SMTP or messaging provider.
          </p>
        </div>

        <div className="flex items-center justify-end gap-unit-sm pt-unit-xs border-t border-surface-container-low mt-unit-2xs">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-unit-md rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors border border-outline-variant/30 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(value);
              onClose();
            }}
            className="h-9 px-unit-md rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium"
          >
            Save Channel Config
          </button>
        </div>
      </div>
    </div>
  );
};
