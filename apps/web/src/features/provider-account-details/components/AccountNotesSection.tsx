import React, { useState } from 'react';
import { ProviderAccountDetail } from '../providerAccountDetails.types';

interface AccountNotesSectionProps {
  account: ProviderAccountDetail;
  onUpdateNotes: (newNotes: string) => void;
}

export const AccountNotesSection: React.FC<AccountNotesSectionProps> = ({
  account,
  onUpdateNotes,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(account.notes);

  const handleSave = () => {
    onUpdateNotes(editedNotes);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedNotes(account.notes);
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl bg-surface-container-lowest p-unit-md shadow-sm border border-outline-variant/30">
      <div className="flex items-center justify-between mb-unit-xs">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">sticky_note_2</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            User-Maintained Account Notes
          </h2>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-caption-xs font-caption-xs text-primary font-medium hover:underline cursor-pointer"
          >
            Edit Notes
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="text-caption-xs font-caption-xs text-secondary hover:text-on-surface cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-caption-xs font-caption-xs text-primary font-semibold hover:underline cursor-pointer"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <textarea
          value={editedNotes}
          onChange={(e) => setEditedNotes(e.target.value)}
          rows={4}
          className="w-full p-unit-sm rounded-lg bg-surface-container-low border border-outline focus:outline-none focus:ring-2 focus:ring-primary text-body-sm font-body-sm text-on-surface"
          placeholder="Enter operational notes or SOP guidelines..."
        />
      ) : (
        <div className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20 text-body-sm font-body-sm text-on-surface-variant leading-relaxed">
          {account.notes}
        </div>
      )}

      {/* Compliance & Security Notice (Strict security rules, no secrets stored) */}
      <div className="mt-unit-sm p-unit-sm rounded-lg bg-surface-container flex items-start gap-2 text-caption-xs font-caption-xs text-on-surface-variant border border-outline-variant/30">
        <span className="material-symbols-outlined text-primary text-[18px] shrink-0">shield</span>
        <div>
          <span className="font-semibold text-on-surface block">Data Privacy Note</span>
          Passwords, API keys, recovery tokens, authentication secrets, payment card data, and private keys are strictly never stored or displayed in DomainPulse.
        </div>
      </div>

      {/* Fast Record Status Log */}
      <div className="mt-unit-md pt-unit-xs">
        <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold tracking-wider">
          Record Status
        </span>
        <div className="mt-unit-xs text-caption-xs font-caption-xs space-y-1 text-secondary font-mono">
          <div className="flex justify-between">
            <span>Last Record Update:</span>
            <span className="text-on-surface">{account.lastRecordUpdateText}</span>
          </div>
          <div className="flex justify-between">
            <span>Discovered Asset Changes:</span>
            <span className="text-emerald-700">{account.discoveredChangesText}</span>
          </div>
          <div className="flex justify-between">
            <span>Mapping Coverage:</span>
            <span className="text-emerald-700">{account.mappingCoverageText}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
