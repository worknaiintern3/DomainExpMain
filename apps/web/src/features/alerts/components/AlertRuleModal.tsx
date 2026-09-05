import React, { useState, useEffect } from 'react';
import { AlertRuleItem, AlertSeverity } from '../alerts.types';

interface AlertRuleModalProps {
  isOpen: boolean;
  rule: AlertRuleItem | null;
  onClose: () => void;
  onSave: (rule: AlertRuleItem) => void;
}

export const AlertRuleModal: React.FC<AlertRuleModalProps> = ({
  isOpen,
  rule,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Domain Expiry');
  const [severity, setSeverity] = useState<AlertSeverity>('WARNING');
  const [thresholdDays, setThresholdDays] = useState(30);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description);
      setCategory(rule.category);
      setSeverity(rule.severity);
      setThresholdDays(rule.thresholdDays);
      setEnabled(rule.enabled);
    } else {
      setName('');
      setDescription('');
      setCategory('Domain Expiry');
      setSeverity('WARNING');
      setThresholdDays(30);
      setEnabled(true);
    }
  }, [rule, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const savedRule: AlertRuleItem = {
      id: rule?.id || `rule-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || `Triggers when ${category.toLowerCase()} is under ${thresholdDays} days.`,
      category,
      severity,
      thresholdDays,
      thresholdOptions: [3, 7, 14, 30, 60],
      enabled,
      deliveryChannelHint: 'In-App, Browser Push',
    };

    onSave(savedRule);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-xl shadow-xl border border-outline-variant/30 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-unit-lg py-unit-md border-b border-surface-container/60 bg-surface-container-low">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              {rule ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-unit-lg flex flex-col gap-unit-md">
          {/* Rule Name */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-semibold">
              Rule Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Domain 14-Day Expiration Warning"
              className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30"
            />
          </div>

          {/* Category & Severity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-unit-md">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-semibold">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
              >
                <option value="Domain Expiry">Domain Expiry</option>
                <option value="SSL Health">SSL Health</option>
                <option value="DNS & Security">DNS &amp; Security</option>
                <option value="Server Renewal">Server Renewal</option>
                <option value="Asset Mapping">Asset Mapping</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface font-semibold">
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer"
              >
                <option value="CRITICAL">Critical (High Urgency)</option>
                <option value="WARNING">Warning (Attention)</option>
                <option value="UPCOMING">Upcoming (Scheduled)</option>
                <option value="INFO">Info (Notice)</option>
              </select>
            </div>
          </div>

          {/* Trigger Threshold */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-semibold">
              Evaluation Threshold (Days before expiry / due date)
            </label>
            <div className="flex items-center gap-2">
              {[3, 7, 14, 30, 60].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setThresholdDays(days)}
                  className={`px-unit-sm py-1 rounded font-label-mono text-label-mono text-caption-xs transition-colors cursor-pointer border ${
                    thresholdDays === days
                      ? 'bg-primary text-on-primary border-primary font-bold'
                      : 'bg-surface-container text-secondary border-outline-variant/20 hover:text-on-surface'
                  }`}
                >
                  ≤ {days}d
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface font-semibold">
              Description / Advisory
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Advisory text shown when alert triggers..."
              className="px-unit-sm py-unit-xs rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 resize-none"
            />
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Enable this rule
              </span>
              <span className="font-caption-xs text-secondary">
                Rule will evaluate against stored portfolio records.
              </span>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-unit-sm pt-unit-xs border-t border-surface-container/60">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-unit-md rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-unit-md rounded-lg bg-primary text-on-primary hover:bg-tertiary transition-colors shadow-xs font-label-md text-label-md cursor-pointer"
            >
              Save Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
