import React, { useEffect, useState } from 'react';
import type { MobileAnnouncement } from '@domainpulse/contracts';
import { mobileAdminClient } from '../api/mobile-admin.client';

export const MobileAnnouncementsPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'critical' | 'promo'>('info');

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true);
      const data = await mobileAdminClient.getAnnouncements();
      setAnnouncements(data);
    } catch {
      // Fallback
      setAnnouncements([]);
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
      const created = await mobileAdminClient.createAnnouncement({
        title: title.trim(),
        message: message.trim(),
        type,
        isActive: true,
      });
      setAnnouncements([created, ...announcements]);
      setTitle('');
      setMessage('');
      setToast('✅ Announcement created and live for mobile clients');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('❌ Failed to publish announcement');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await mobileAdminClient.deleteAnnouncement(id);
      setAnnouncements(announcements.filter((a) => a.id !== id));
      setToast('🗑️ Announcement removed');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to delete announcement');
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">In-App Announcements & Banners</h2>
        <p className="text-sm text-slate-400 mt-1">
          Broadcast critical notices, maintenance warnings, or promotional messages to all mobile users.
        </p>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Creation Card */}
      <form onSubmit={handleCreate} className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 shadow-xl">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Create New Broadcast</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled Maintenance Window"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Severity Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="info">Info (Blue)</option>
              <option value="warning">Warning (Amber)</option>
              <option value="critical">Critical (Red)</option>
              <option value="promo">Promo (Purple)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Message Body</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Detailed description shown inside the mobile banner card"
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all text-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Broadcasting...' : 'Publish Announcement'}
        </button>
      </form>

      {/* Announcements List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Active & Past Announcements ({announcements.length})
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No announcements published yet.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        ann.type === 'critical'
                          ? 'bg-rose-500/20 text-rose-400'
                          : ann.type === 'warning'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {ann.type}
                    </span>
                    <span className="font-semibold text-white text-sm">{ann.title}</span>
                  </div>
                  <p className="text-xs text-slate-400">{ann.message}</p>
                </div>

                <button
                  onClick={() => handleDelete(ann.id)}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors border border-rose-500/20"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
