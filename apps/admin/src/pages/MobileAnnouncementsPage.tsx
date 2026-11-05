import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { MobileAnnouncement } from '@domainpulse/contracts';
import { adminClient } from '../api/admin.client';
import {
  IconBell,
  IconCheckCircle,
  IconEdit,
  IconFilter,
  IconMegaphone,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconTrash,
} from '../components/Icons';

export interface PushBroadcastRecord {
  id: string;
  title: string;
  message: string;
  platform: 'all' | 'android' | 'ios';
  recipientsCount?: number;
  devicesCount?: number;
  createdAt: string;
  type?: 'info' | 'warning' | 'critical' | 'promo';
}

const LOCAL_STORAGE_PUSH_KEY = 'dp_admin_push_history_v2';
const LOCAL_STORAGE_PUSH_DELETED_KEY = 'dp_admin_push_deleted_ids_v2';

export const MobileAnnouncementsPage: React.FC = () => {
  // Announcements & Push states
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [pushBroadcasts, setPushBroadcasts] = useState<PushBroadcastRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Active view tab: Announcement or Direct Push
  const [activeTab, setActiveTab] = useState<'announcement' | 'direct_push'>('announcement');

  // Announcement Form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'critical' | 'promo'>('info');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [sendPushWithAnnouncement, setSendPushWithAnnouncement] = useState<boolean>(true);

  // Direct Push Broadcast Form
  const [directPushTitle, setDirectPushTitle] = useState('');
  const [directPushMessage, setDirectPushMessage] = useState('');
  const [directPushPlatform, setDirectPushPlatform] = useState<'all' | 'android' | 'ios'>('all');
  const [directPushType, setDirectPushType] = useState<'info' | 'warning' | 'critical' | 'promo'>('info');
  const [isBroadcastingPush, setIsBroadcastingPush] = useState<boolean>(false);

  // List search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'critical' | 'warning' | 'info' | 'promo'>('all');

  // Actions in progress
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Edit Modal State (supports both Announcement and Push)
  const [editingItem, setEditingItem] = useState<{
    targetType: 'announcement' | 'push';
    item: MobileAnnouncement | PushBroadcastRecord;
  } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editType, setEditType] = useState<'info' | 'warning' | 'critical' | 'promo'>('info');
  const [editActionUrl, setEditActionUrl] = useState('');
  const [editActionLabel, setEditActionLabel] = useState('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editPlatform, setEditPlatform] = useState<'all' | 'android' | 'ios'>('all');
  const [editResendPush, setEditResendPush] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Fetch live in-app announcements from backend
      const annList = await adminClient.getAnnouncements().catch(() => []);
      setAnnouncements(annList || []);

      // 2. Fetch push broadcast history from audit logs
      const auditLogs = await adminClient.getAuditLogs().catch(() => []);
      const pushLogs = (auditLogs || []).filter(
        (log: any) => log.action === 'BROADCAST_PUSH_NOTIFICATION',
      );

      const parsedAuditPushes: PushBroadcastRecord[] = pushLogs.map((log: any) => {
        let details: any = {};
        if (typeof log.details === 'string') {
          try {
            details = JSON.parse(log.details);
          } catch {
            details = { message: log.details };
          }
        } else if (log.details && typeof log.details === 'object') {
          details = log.details;
        }

        return {
          id: log.id,
          title: details.title || 'Fleet Push Broadcast',
          message: details.message || '',
          platform: (details.platform as any) || 'all',
          recipientsCount: details.recipientsCount ?? 0,
          devicesCount: details.devicesCount ?? 0,
          createdAt: log.createdAt || new Date().toISOString(),
          type: details.type || 'info',
        };
      });

      // 3. Load locally saved push history and deleted IDs
      let localHistory: PushBroadcastRecord[] = [];
      try {
        const rawLocal = localStorage.getItem(LOCAL_STORAGE_PUSH_KEY);
        if (rawLocal) localHistory = JSON.parse(rawLocal);
      } catch {}

      let deletedIds: string[] = [];
      try {
        const rawDeleted = localStorage.getItem(LOCAL_STORAGE_PUSH_DELETED_KEY);
        if (rawDeleted) deletedIds = JSON.parse(rawDeleted);
      } catch {}

      // Combine local history and server audit logs, removing deleted ones
      const combined = [...localHistory, ...parsedAuditPushes].filter(
        (item) => !deletedIds.includes(item.id),
      );

      // Deduplicate by ID
      const map = new Map<string, PushBroadcastRecord>();
      combined.forEach((item) => {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      });

      const sortedPushes = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setPushBroadcasts(sortedPushes);
    } catch (err) {
      console.warn('Error loading announcements/push records:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tab switcher with state hygiene
  const handleTabSwitch = (newTab: 'announcement' | 'direct_push') => {
    setActiveTab(newTab);
    setFilterType('all');
    setSearchQuery('');
  };

  // 1. Create In-App Announcement (+ optional push alert)
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    try {
      setIsSubmitting(true);
      // Strictly send only recognized keys to remote backend to satisfy Zod schema
      const created = await adminClient.createAnnouncement({
        title: title.trim(),
        message: message.trim(),
        type,
        actionUrl: actionUrl.trim() || null,
        actionLabel: actionLabel.trim() || null,
        isActive: true,
      });

      // If push dispatch is selected, notify registered mobile devices
      if (sendPushWithAnnouncement) {
        await adminClient.broadcastNotification({
          title: title.trim(),
          message: message.trim(),
          platform: 'all',
        }).catch((err) => console.warn('Push broadcast warning:', err));
      }

      setAnnouncements((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      setTitle('');
      setMessage('');
      setActionUrl('');
      setActionLabel('');
      setToast(
        sendPushWithAnnouncement
          ? '✓ Announcement published to mobile home screen & push alert dispatched to devices!'
          : '✓ Announcement published to mobile home screen!',
      );
      setTimeout(() => setToast(null), 4000);
      loadData();
    } catch (err: any) {
      setToast(err?.message || 'Failed to publish announcement');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Direct Fleet Push Notification Broadcaster
  const handleDirectPushBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directPushTitle.trim() || !directPushMessage.trim()) return;

    try {
      setIsBroadcastingPush(true);
      // Dispatch real push notification to all mobile physical devices via broadcast endpoint
      const res = await adminClient.broadcastNotification({
        title: directPushTitle.trim(),
        message: directPushMessage.trim(),
        platform: directPushPlatform,
      });

      const newPushItem: PushBroadcastRecord = {
        id: 'push_' + Date.now(),
        title: directPushTitle.trim(),
        message: directPushMessage.trim(),
        platform: directPushPlatform,
        recipientsCount: res?.recipientsCount ?? 0,
        devicesCount: res?.devicesCount ?? 0,
        createdAt: new Date().toISOString(),
        type: directPushType,
      };

      setPushBroadcasts((prev) => {
        const next = [newPushItem, ...prev];
        try {
          localStorage.setItem(LOCAL_STORAGE_PUSH_KEY, JSON.stringify(next.slice(0, 100)));
        } catch {}
        return next;
      });

      setDirectPushTitle('');
      setDirectPushMessage('');
      setToast(
        `✓ Push notification transmitted to ${res?.recipientsCount ?? 'all'} users (${res?.devicesCount ?? 'all'} active devices)!`,
      );
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast(err?.message || 'Failed to transmit push broadcast');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsBroadcastingPush(false);
    }
  };

  // Re-send / Send Again
  const handleResendAnnouncementPush = async (item: MobileAnnouncement) => {
    if (!window.confirm(`Send push notification for "${item.title}" to all mobile devices now?`)) {
      return;
    }
    try {
      setResendingId(item.id);
      const res = await adminClient.broadcastNotification({
        title: item.title,
        message: item.message,
        platform: 'all',
      });
      setToast(
        `✓ Push notification re-sent to ${res.recipientsCount ?? 'all'} users (${res.devicesCount ?? 'all'} registered devices)!`,
      );
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast(err?.message || 'Failed to re-send push notification');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setResendingId(null);
    }
  };

  const handleResendDirectPush = async (item: PushBroadcastRecord) => {
    if (!window.confirm(`Re-send push notification "${item.title}" to ${item.platform === 'all' ? 'all mobile devices' : item.platform}?`)) {
      return;
    }
    try {
      setResendingId(item.id);
      const res = await adminClient.broadcastNotification({
        title: item.title,
        message: item.message,
        platform: item.platform,
      });
      setToast(
        `✓ Push notification re-sent to ${res.recipientsCount ?? 'all'} users (${res.devicesCount ?? 'all'} registered devices)!`,
      );
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast(err?.message || 'Failed to re-send push notification');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setResendingId(null);
    }
  };

  // Toggle Active/Inactive for In-App Announcements
  const handleToggleActive = async (item: MobileAnnouncement) => {
    try {
      setTogglingId(item.id);
      const updated = await adminClient.updateAnnouncement(item.id, {
        isActive: !item.isActive,
      });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, isActive: updated.isActive } : a)),
      );
      setToast(`Announcement banner ${updated.isActive ? 'activated' : 'paused'}.`);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast(err?.message || 'Failed to update status');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTogglingId(null);
    }
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this in-app announcement?')) {
      return;
    }
    try {
      setDeletingId(id);
      await adminClient.deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setToast('✓ In-app announcement deleted successfully');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast(err?.message || 'Failed to delete announcement');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  // Delete Push Notification from history
  const handleDeletePushNotification = (id: string) => {
    if (!window.confirm('Are you sure you want to remove this push notification from history?')) {
      return;
    }
    try {
      setDeletingId(id);
      setPushBroadcasts((prev) => {
        const next = prev.filter((p) => p.id !== id);
        try {
          localStorage.setItem(LOCAL_STORAGE_PUSH_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Mark as deleted so it doesn't reload from audit logs
      try {
        const rawDeleted = localStorage.getItem(LOCAL_STORAGE_PUSH_DELETED_KEY);
        const deleted: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
        if (!deleted.includes(id)) {
          deleted.push(id);
          localStorage.setItem(LOCAL_STORAGE_PUSH_DELETED_KEY, JSON.stringify(deleted));
        }
      } catch {}

      setToast('✓ Push notification removed from history');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEditAnnouncement = (item: MobileAnnouncement) => {
    setEditingItem({ targetType: 'announcement', item });
    setEditTitle(item.title);
    setEditMessage(item.message);
    setEditType(item.type);
    setEditActionUrl(item.actionUrl || '');
    setEditActionLabel(item.actionLabel || '');
    setEditIsActive(item.isActive);
    setEditResendPush(false);
  };

  const handleOpenEditPush = (item: PushBroadcastRecord) => {
    setEditingItem({ targetType: 'push', item });
    setEditTitle(item.title);
    setEditMessage(item.message);
    setEditType(item.type || 'info');
    setEditPlatform(item.platform || 'all');
    setEditActionUrl('');
    setEditActionLabel('');
    setEditIsActive(true);
    setEditResendPush(false);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editTitle.trim() || !editMessage.trim()) return;

    try {
      setIsSavingEdit(true);

      if (editingItem.targetType === 'announcement') {
        const updated = await adminClient.updateAnnouncement(editingItem.item.id, {
          title: editTitle.trim(),
          message: editMessage.trim(),
          type: editType,
          actionUrl: editActionUrl.trim() || null,
          actionLabel: editActionLabel.trim() || null,
          isActive: editIsActive,
        });

        if (editResendPush) {
          await adminClient.broadcastNotification({
            title: editTitle.trim(),
            message: editMessage.trim(),
            platform: 'all',
          }).catch(() => {});
        }

        setAnnouncements((prev) =>
          prev.map((a) => (a.id === editingItem.item.id ? { ...a, ...updated } : a)),
        );
        setToast(
          editResendPush
            ? '✓ Announcement updated & push notification re-broadcasted!'
            : '✓ Announcement updated successfully!',
        );
      } else {
        // Edit Push Notification
        const updatedRecord: PushBroadcastRecord = {
          ...(editingItem.item as PushBroadcastRecord),
          title: editTitle.trim(),
          message: editMessage.trim(),
          type: editType,
          platform: editPlatform,
          createdAt: new Date().toISOString(),
        };

        if (editResendPush) {
          await adminClient.broadcastNotification({
            title: editTitle.trim(),
            message: editMessage.trim(),
            platform: editPlatform,
          }).catch(() => {});
        }

        setPushBroadcasts((prev) => {
          const next = prev.map((p) => (p.id === editingItem.item.id ? updatedRecord : p));
          try {
            localStorage.setItem(LOCAL_STORAGE_PUSH_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });

        setToast(
          editResendPush
            ? '✓ Push notification updated & re-dispatched to devices!'
            : '✓ Push notification updated in history!',
        );
      }

      setEditingItem(null);
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast(err?.message || 'Failed to update');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filter in-app announcements (never push)
  const announcementItems = useMemo(() => {
    return announcements.filter(
      (item) => (item as any).broadcastType !== 'push' && item.actionUrl !== '#push_notification',
    );
  }, [announcements]);

  // Filtered lists based on active tab and search query
  const filteredAnnouncements = useMemo(() => {
    return announcementItems.filter((item) => {
      if (filterType === 'active' && !item.isActive) return false;
      if (filterType === 'inactive' && item.isActive) return false;
      if (filterType === 'critical' && item.type !== 'critical') return false;
      if (filterType === 'warning' && item.type !== 'warning') return false;
      if (filterType === 'info' && item.type !== 'info') return false;
      if (filterType === 'promo' && item.type !== 'promo') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchMessage = item.message?.toLowerCase().includes(q);
        return matchTitle || matchMessage;
      }
      return true;
    });
  }, [announcementItems, filterType, searchQuery]);

  const filteredPushBroadcasts = useMemo(() => {
    return pushBroadcasts.filter((item) => {
      if (filterType === 'critical' && item.type !== 'critical') return false;
      if (filterType === 'warning' && item.type !== 'warning') return false;
      if (filterType === 'info' && item.type !== 'info') return false;
      if (filterType === 'promo' && item.type !== 'promo') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchMessage = item.message?.toLowerCase().includes(q);
        return matchTitle || matchMessage;
      }
      return true;
    });
  }, [pushBroadcasts, filterType, searchQuery]);

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading announcements & push notifications...</div>;
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
            Broadcast push alerts directly to users&apos; physical devices, pin banner notices, and manage sent notifications.
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <IconRefresh size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <IconCheckCircle size={16} />
          {toast}
        </div>
      )}

      {/* MODE SELECTOR TABS */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => handleTabSwitch('announcement')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'announcement'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <IconMegaphone size={15} />
          <span>In-App Announcements</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'announcement'
                ? 'bg-blue-700 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {announcementItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('direct_push')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'direct_push'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <IconBell size={15} />
          <span>Push Notifications</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'direct_push'
                ? 'bg-indigo-700 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {pushBroadcasts.length}
          </span>
        </button>
      </div>

      {/* 1. ANNOUNCEMENT FORM */}
      {activeTab === 'announcement' && (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <IconPlus size={15} className="text-blue-500" />
              Publish New In-App Announcement Banner
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Mobile Home Screen
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Creates a persistent banner at the top of the mobile home screen. Optionally sends a real-time push notification alert simultaneously.
          </p>

          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
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
                  placeholder="e.g. https://domainpulse.io/features or /alerts"
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

              {/* Push Dispatch Checkbox */}
              <div className="md:col-span-3 flex items-center justify-between p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <IconBell size={18} className="text-blue-600 dark:text-blue-400" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Also Dispatch Real-Time Push Notification
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Buzzes users&apos; physical mobile devices (APNs & FCM) and adds to their notification center
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendPushWithAnnouncement}
                    onChange={(e) => setSendPushWithAnnouncement(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {sendPushWithAnnouncement ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>

              <div className="md:col-span-3 flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <IconSend size={14} />
                  <span>{isSubmitting ? 'Publishing...' : 'Publish Announcement Banner'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 2. DIRECT PUSH BROADCAST FORM */}
      {activeTab === 'direct_push' && (
        <div className="p-6 rounded-2xl border border-indigo-200 dark:border-indigo-950 bg-indigo-50/30 dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
              <IconBell size={16} className="text-indigo-600 dark:text-indigo-400" />
              Direct Fleet Push Notification Broadcaster
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Instant Push Only
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Broadcast an instant push notification directly to user devices. Appears on lock screens and in the notification drawer (/alerts). Will <strong>never</strong> appear as an announcement banner on the home screen.
          </p>

          <form onSubmit={handleDirectPushBroadcast} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notification Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Critical SSL Certificate Alert"
                  value={directPushTitle}
                  onChange={(e) => setDirectPushTitle(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Operating System
                </label>
                <select
                  value={directPushPlatform}
                  onChange={(e) => setDirectPushPlatform(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="all">All Devices (Android & iOS)</option>
                  <option value="android">Google Android Only</option>
                  <option value="ios">Apple iOS Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Severity Type
                </label>
                <select
                  value={directPushType}
                  onChange={(e) => setDirectPushType(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="info">Info</option>
                  <option value="promo">Promo / Feature</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Push Message Content
                </label>
                <textarea
                  placeholder="Enter the push notification body text that will display on users' lock screens and status bars..."
                  value={directPushMessage}
                  onChange={(e) => setDirectPushMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="md:col-span-3 flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={isBroadcastingPush}
                  className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <IconSend size={14} />
                  <span>{isBroadcastingPush ? 'Transmitting Broadcast...' : 'Send Push Notification Now'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* NOTIFICATIONS & ANNOUNCEMENTS DEDICATED LIST */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>{activeTab === 'announcement' ? 'Sent In-App Announcements' : 'Sent Push Notifications'}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold border ${
                activeTab === 'announcement'
                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
              }`}>
                {activeTab === 'announcement' ? announcementItems.length : pushBroadcasts.length} TOTAL
              </span>
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                title="Reload list"
              >
                <IconRefresh size={13} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeTab === 'announcement'
                ? 'Manage persistent in-app announcement banners displayed at the top of the mobile home screen.'
                : 'Manage push notifications dispatched to user devices (lock screen & alerts center).'}
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <IconSearch size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'announcement' ? 'Search announcements...' : 'Search push notifications...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>

        {/* Filter Pills with Item Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <IconFilter size={13} className="text-slate-400 mr-1 flex-shrink-0" />
          {(activeTab === 'announcement'
            ? [
                { key: 'all', label: `All (${announcementItems.length})` },
                { key: 'active', label: `Active Banners (${announcementItems.filter((a) => a.isActive).length})` },
                { key: 'inactive', label: `Paused (${announcementItems.filter((a) => !a.isActive).length})` },
                { key: 'critical', label: `Critical (${announcementItems.filter((a) => a.type === 'critical').length})` },
                { key: 'warning', label: `Warning (${announcementItems.filter((a) => a.type === 'warning').length})` },
                { key: 'info', label: `Info (${announcementItems.filter((a) => a.type === 'info').length})` },
                { key: 'promo', label: `Promo (${announcementItems.filter((a) => a.type === 'promo').length})` },
              ]
            : [
                { key: 'all', label: `All (${pushBroadcasts.length})` },
                { key: 'critical', label: `Critical (${pushBroadcasts.filter((p) => p.type === 'critical').length})` },
                { key: 'warning', label: `Warning (${pushBroadcasts.filter((p) => p.type === 'warning').length})` },
                { key: 'info', label: `Info (${pushBroadcasts.filter((p) => (p.type || 'info') === 'info').length})` },
                { key: 'promo', label: `Promo (${pushBroadcasts.filter((p) => p.type === 'promo').length})` },
              ]
          ).map((pill) => (
            <button
              key={pill.key}
              onClick={() => setFilterType(pill.key as any)}
              className={`px-3 py-1 rounded-full font-semibold transition-colors flex-shrink-0 border ${
                filterType === pill.key
                  ? activeTab === 'announcement'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* TAB 1: LIST OF ANNOUNCEMENTS */}
        {activeTab === 'announcement' && (
          <div>
            {filteredAnnouncements.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
                {searchQuery
                  ? 'No announcements match your search query.'
                  : 'No in-app announcements found. Create one using the form above.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAnnouncements.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Type Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
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

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
                            item.isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {item.isActive ? 'Live Banner' : 'Paused'}
                        </span>

                        {/* Created Date */}
                        {item.createdAt && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto md:ml-0 font-mono">
                            {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {item.message}
                        </p>
                      </div>

                      {item.actionUrl && (
                        <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 flex items-center gap-2 pt-0.5">
                          <span className="font-semibold">Action Link:</span>
                          <span className="underline truncate max-w-md">{item.actionUrl}</span>
                          {item.actionLabel && <span className="text-slate-500 font-sans">({item.actionLabel})</span>}
                        </div>
                      )}
                    </div>

                    {/* Announcement Action Toolbar */}
                    <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 flex-shrink-0">
                      {/* Send Again (Push Notification) */}
                      <button
                        onClick={() => handleResendAnnouncementPush(item)}
                        disabled={resendingId === item.id}
                        className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                        title="Send push notification alert for this banner to all user devices"
                      >
                        <IconSend size={12} className={resendingId === item.id ? 'animate-pulse' : ''} />
                        <span>{resendingId === item.id ? 'Sending...' : 'Send Push Again'}</span>
                      </button>

                      {/* Toggle Active / Paused */}
                      <button
                        onClick={() => handleToggleActive(item)}
                        disabled={togglingId === item.id}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors disabled:opacity-50 ${
                          item.isActive
                            ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
                            : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
                        }`}
                        title={item.isActive ? 'Pause announcement banner in mobile app' : 'Activate announcement banner in mobile app'}
                      >
                        {item.isActive ? 'Pause Banner' : 'Activate Banner'}
                      </button>

                      {/* Edit Announcement */}
                      <button
                        onClick={() => handleOpenEditAnnouncement(item)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 transition-colors shadow-sm"
                        title="Edit Announcement"
                      >
                        <IconEdit size={14} />
                      </button>

                      {/* Delete Announcement */}
                      <button
                        onClick={() => handleDeleteAnnouncement(item.id)}
                        disabled={deletingId === item.id}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 transition-colors disabled:opacity-50 shadow-sm"
                        title="Delete Announcement"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIST OF PUSH NOTIFICATIONS */}
        {activeTab === 'direct_push' && (
          <div>
            {filteredPushBroadcasts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
                {searchQuery
                  ? 'No push notifications match your search query.'
                  : 'No push notifications sent yet. Use the broadcaster above to send one.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPushBroadcasts.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl border border-indigo-200/60 dark:border-indigo-950 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Type Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            item.type === 'critical'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                              : item.type === 'warning'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                              : item.type === 'promo'
                              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30'
                          }`}
                        >
                          {item.type || 'info'}
                        </span>

                        {/* Push Notification Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center gap-1">
                          <IconBell size={10} />
                          Device Push Sent
                        </span>

                        {/* Target Platform */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {item.platform === 'android' ? 'Android' : item.platform === 'ios' ? 'iOS' : 'All Devices'}
                        </span>

                        {/* Created Date */}
                        {item.createdAt && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto md:ml-0 font-mono">
                            {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    {/* Push Management Action Toolbar */}
                    <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 flex-shrink-0">
                      {/* Send Again */}
                      <button
                        onClick={() => handleResendDirectPush(item)}
                        disabled={resendingId === item.id}
                        className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                        title="Re-broadcast push notification to all mobile devices now"
                      >
                        <IconSend size={12} className={resendingId === item.id ? 'animate-pulse' : ''} />
                        <span>{resendingId === item.id ? 'Sending...' : 'Send Again'}</span>
                      </button>

                      {/* Edit Push Notification */}
                      <button
                        onClick={() => handleOpenEditPush(item)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition-colors shadow-sm"
                        title="Edit Push Notification"
                      >
                        <IconEdit size={14} />
                      </button>

                      {/* Delete Push Notification */}
                      <button
                        onClick={() => handleDeletePushNotification(item.id)}
                        disabled={deletingId === item.id}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 transition-colors disabled:opacity-50 shadow-sm"
                        title="Delete from history"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <IconEdit size={18} className="text-blue-500" />
                {editingItem.targetType === 'announcement' ? 'Edit In-App Announcement Banner' : 'Edit Push Notification'}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Headline / Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Severity Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="info">Info</option>
                    <option value="promo">Promo / Feature</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                {editingItem.targetType === 'push' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Platform
                    </label>
                    <select
                      value={editPlatform}
                      onChange={(e) => setEditPlatform(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
                    >
                      <option value="all">All Devices (Android & iOS)</option>
                      <option value="android">Android Only</option>
                      <option value="ios">iOS Only</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Message
                </label>
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {editingItem.targetType === 'announcement' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Action URL
                    </label>
                    <input
                      type="text"
                      value={editActionUrl}
                      onChange={(e) => setEditActionUrl(e.target.value)}
                      placeholder="e.g. /alerts"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Action Label
                    </label>
                    <input
                      type="text"
                      value={editActionLabel}
                      onChange={(e) => setEditActionLabel(e.target.value)}
                      placeholder="e.g. Learn More"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Status & Push Checkboxes */}
              <div className="space-y-2 pt-1">
                {editingItem.targetType === 'announcement' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded accent-blue-600"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Active Banner (Displayed at top of mobile home screen)
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40">
                  <input
                    type="checkbox"
                    checked={editResendPush}
                    onChange={(e) => setEditResendPush(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 block">
                      Re-send Push Notification immediately on save
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Dispatches the updated message directly to mobile devices (status bar & alert drawer)
                    </span>
                  </div>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
