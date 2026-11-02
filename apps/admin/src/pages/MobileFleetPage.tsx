import React, { useEffect, useState } from 'react';
import { adminClient } from '../api/admin.client';
import {
  IconAndroid,
  IconApple,
  IconBell,
  IconCheckCircle,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSmartphone,
} from '../components/Icons';
import type { PlatformUser } from '../types/admin.types';

export const MobileFleetPage: React.FC = () => {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'ios' | 'android'>('all');

  // Push broadcast state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPlatform, setBroadcastPlatform] = useState<'all' | 'ios' | 'android'>('all');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await adminClient.getUsers({ type: 'mobile' });
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Extract all devices
  const allDevices = users.flatMap((u) => {
    return (u.mobileData.devices || []).map((d) => ({
      ...d,
      ownerEmail: u.email,
      ownerName: u.displayName,
      ownerUserId: u.id,
      userPlan: u.plan,
    }));
  });

  const filteredDevices = allDevices.filter((d) => {
    if (platformFilter !== 'all' && d.platform !== platformFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchDevice = d.deviceName.toLowerCase().includes(q);
      const matchEmail = d.ownerEmail.toLowerCase().includes(q);
      const matchVersion = d.appVersion.toLowerCase().includes(q);
      return matchDevice || matchEmail || matchVersion;
    }
    return true;
  });

  const iosCount = allDevices.filter((d) => d.platform === 'ios').length;
  const androidCount = allDevices.filter((d) => d.platform === 'android').length;
  const pushActiveCount = allDevices.filter((d) => d.token).length;

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setBroadcastSending(true);
    try {
      const res = await adminClient.broadcastNotification({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        platform: broadcastPlatform,
      });
      setSuccessBanner(
        `Push broadcast "${broadcastTitle}" successfully transmitted to ${res.recipientsCount ?? allDevices.length} users (${res.devicesCount ?? allDevices.length} registered mobile devices).`,
      );
      setShowBroadcastModal(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      alert(`Broadcast failed: ${err?.message}`);
    } finally {
      setBroadcastSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Mobile Application Fleet & Devices
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
              {allDevices.length} Linked Devices
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time telemetry, APNs & FCM push token registry, installed mobile version tracking, and push broadcaster.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all flex items-center gap-1.5"
          >
            <IconSend size={14} />
            <span>Broadcast Push Campaign</span>
          </button>

          <button
            onClick={fetchUsers}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <IconRefresh size={14} />
          </button>
        </div>
      </div>

      {successBanner ? (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <IconCheckCircle size={16} />
            {successBanner}
          </span>
          <button onClick={() => setSuccessBanner(null)} className="font-bold">✕</button>
        </div>
      ) : null}

      {/* Fleet KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <IconSmartphone size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Fleet Size</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{allDevices.length} Devices</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
            <IconApple size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Apple iOS Fleet</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{iosCount} Devices</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <IconAndroid size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Google Android Fleet</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{androidCount} Devices</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <IconBell size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Push Tokens Reach</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{pushActiveCount} / {allDevices.length}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <IconSearch
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by device model (iPhone/Pixel), user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="all">All Mobile Operating Systems</option>
            <option value="ios">Apple iOS Only</option>
            <option value="android">Google Android Only</option>
          </select>
        </div>
      </div>

      {/* Device Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>Scanning registered mobile devices...</span>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">No mobile devices match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-6">Device Model</th>
                  <th className="py-3.5 px-4">OS Platform</th>
                  <th className="py-3.5 px-4">Installed App Version</th>
                  <th className="py-3.5 px-4">Owner User Account</th>
                  <th className="py-3.5 px-4">Push Token Registry</th>
                  <th className="py-3.5 px-4">Last Mobile Ping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {filteredDevices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 flex-shrink-0">
                        {dev.platform === 'ios' ? <IconApple size={16} /> : <IconAndroid size={16} />}
                      </div>
                      <span>{dev.deviceName}</span>
                    </td>

                    <td className="py-4 px-4 uppercase font-bold text-[11px] text-slate-500 dark:text-slate-400">
                      {dev.platform}
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
                        v{dev.appVersion}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {dev.ownerEmail}
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px]">
                      {dev.token ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          APNs / FCM Token Active
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No push token</span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(dev.lastSeenAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Broadcast Push Campaign Modal */}
      {showBroadcastModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <IconSend size={16} className="text-indigo-500" />
                Fleet-Wide Push Broadcast
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Operating System
                </label>
                <select
                  value={broadcastPlatform}
                  onChange={(e) => setBroadcastPlatform(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Platforms ({allDevices.length} devices)</option>
                  <option value="ios">Apple iOS Only ({iosCount} devices)</option>
                  <option value="android">Google Android Only ({androidCount} devices)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Campaign Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DomainPulse v1.2 Released"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Push Notification Message
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Notification alert copy shown on user lockscreens..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={broadcastSending}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition-all disabled:opacity-50"
                >
                  {broadcastSending ? 'Broadcasting...' : 'Send to Fleet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
