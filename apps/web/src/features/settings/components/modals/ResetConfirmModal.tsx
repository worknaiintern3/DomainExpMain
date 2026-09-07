import React from 'react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-unit-lg shadow-2xl border border-outline-variant/40 flex flex-col gap-unit-md scale-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">warning</span>
          </div>
          <div className="flex flex-col">
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Reset Workspace Demo Data?
            </h4>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Destructive Action Confirmation
            </span>
          </div>
        </div>

        <p className="font-body-sm text-body-sm text-secondary">
          Are you sure you want to reset all workspace settings and demo data? This will restore initial defaults for all 7 settings categories in your local demo session.
        </p>

        <div className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-tertiary">info</span>
          <span className="font-caption-xs text-caption-xs text-secondary">
            Your live environment and external accounts remain untouched.
          </span>
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
              onConfirm();
              onClose();
            }}
            className="h-9 px-unit-md rounded-lg bg-error text-on-error font-label-md text-label-md hover:bg-error/90 transition-colors shadow-micro cursor-pointer font-medium"
          >
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  );
};
