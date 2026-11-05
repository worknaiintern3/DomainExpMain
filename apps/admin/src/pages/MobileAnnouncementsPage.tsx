import React, { useEffect, useState } from 'react';
import type { MobileAnnouncement } from '@domainpulse/contracts';
import { adminClient } from '../api/admin.client';
import { IconCheckCircle, IconMegaphone, IconPlus, IconRefresh, IconTrash } from '../components/Icons';

export const MobileAnnouncementsPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'critical' | 'promo'>('info');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true);
      const data = await adminClient.getAnnouncements();
      setAnnouncements(data);
    } catch {
      // Handled in client fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    try {
      setIsSubmitting(true);
      const created = await adminClient.createAnnouncement({
        title: title.trim(),
        message: message.trim(),
        type,
        actionUrl: actionUrl.trim() || null,
        actionLabel: actionLabel.trim() || null,
        isActive: true,
      });
      setAnnouncements([created, ...announcements]);
      setTitle('');
      setMessage('');
      setActionUrl('');
      setActionLabel('');
      setToast('Announcement broadcasted and live for all mobile users');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to publish announcement');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

    const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }
    try {
      setDeletingId(id);
      await adminClient.deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setToast('Announcement deleted successfully');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast(err?.message || 'Failed to delete announcement');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading announcements...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <IconMegaphone size={24} className="text-amber-500" />
            In-App Mobile Announcements & Push
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Publish notices, release banners, promo cards, and maintenance warnings directly to mobile users.
          </p>
        </div>

        <button
          onClick={loadAnnouncements}
          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm"
        >
          <IconRefresh size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <IconCheckCircle size={16} />
          {toast}
        </div>
      )}

      {/* CREATE FORM */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <IconPlus size={15} className="text-blue-500" />
          Broadcast New Announcement
        </h3>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Headline / Title
              </label>
              <input
                type="text"
                placeholder="e.g. DomainPulse Mobile v1.2 Released"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Announcement Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="info">Info (Blue Accent)</option>
                <option value="promo">Promo / Feature (Purple)</option>
                <option value="warning">Warning Notice (Amber)</option>
                <option value="critical">Critical Outage / Alert (Red)</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Detailed Message
              </label>
              <textarea
                placeholder="Content displayed in the mobile home top announcement banner..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Action Deep Link URL (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. https://domainpulse.io/features"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Action Button Label (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Learn More"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-end justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Publishing...' : 'Publish Announcement'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ANNOUNCEMENT LIST */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Active Mobile Announcements ({announcements.length})
        </h3>

        {announcements.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            No announcements currently active. Use the form above to broadcast one.
          </div>
        ) : (
          announcements.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-start justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      item.type === 'critical'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                        : item.type === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                        : item.type === 'promo'
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30'
                    }`}
                  >
                    {item.type}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h4>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">{item.message}</p>

                {item.actionUrl && (
                  <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 flex items-center gap-2 pt-1">
                    <span>Link: {item.actionUrl}</span>
                    {item.actionLabel && <span>({item.actionLabel})</span>}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50"
                title="Delete Announcement"
              >
                <IconTrash size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
