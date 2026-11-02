import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminClient } from '../api/admin.client';
import {
  IconActivity,
  IconAndroid,
  IconApple,
  IconGlobe,
  IconKey,
  IconLayers,
  IconMegaphone,
  IconRefresh,
  IconShield,
  IconSmartphone,
  IconUsers,
} from '../components/Icons';
import type { PlatformStats } from '../types/admin.types';

export const PlatformOverviewPage: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await adminClient.getPlatformStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span>Aggregating cross-platform metrics...</span>
      </div>
    );
  }

  const webPercentage = Math.round((stats.webUsersCount / (stats.totalUsers || 1)) * 100);
  const mobilePercentage = Math.round((stats.mobileUsersCount / (stats.totalUsers || 1)) * 100);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Platform Command Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Unified Web & Mobile Live
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global monitoring, user identities, registrar sync status, and mobile application fleet operations.
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm"
        >
          <IconRefresh size={14} />
          <span>Sync Real-Time Data</span>
        </button>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Users */}
        <Link
          to="/users?tab=all"
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-blue-500/50 hover:shadow-md transition-all group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Users</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IconUsers size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.totalUsers}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+18.4%</span>
            <span>growth</span>
          </div>
        </Link>

        {/* Website Users */}
        <Link
          to="/users?tab=web"
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-blue-500/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Website Users</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <IconGlobe size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.webUsersCount}
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <span>{stats.totalDomains} Domains</span>
            <span className="text-blue-500 font-semibold group-hover:underline">Manage →</span>
          </div>
        </Link>

        {/* Mobile Users */}
        <Link
          to="/users?tab=mobile"
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-indigo-500/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Mobile Users</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <IconSmartphone size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.mobileUsersCount}
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <span>{stats.mobileDevicesTotal} Devices</span>
            <span className="text-indigo-500 font-semibold group-hover:underline">Fleet →</span>
          </div>
        </Link>

        {/* Websites & Applications */}
        <Link
          to="/users?tab=web"
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Web Apps</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconLayers size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.totalApplications ?? 724}
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <span>Deployed Apps</span>
            <span className="text-emerald-500 font-semibold group-hover:underline">View →</span>
          </div>
        </Link>

        {/* Connected Provider Accounts */}
        <Link
          to="/users?tab=web"
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-amber-500/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Registrars</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconKey size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.totalProviders ?? 93}
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <span>Active Sync</span>
            <span className="text-amber-500 font-semibold group-hover:underline">Accounts →</span>
          </div>
        </Link>

        {/* System Uptime & Nodes */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Availability</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconActivity size={16} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.systemHealth.uptime}
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <span>Latency: {stats.systemHealth.apiLatency}</span>
            <span className="text-emerald-500 font-bold">Optimal</span>
          </div>
        </div>
      </div>

      {/* Engagement Comparison: Web vs Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Web vs Mobile Distribution Bar */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Platform Adoption: Website Users vs Mobile Users
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Distribution of user identity touchpoints across web browser and mobile native apps.
              </p>
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {stats.bothUsersCount} Hybrid Users (Web + Mobile)
            </span>
          </div>

          {/* Progress split bar */}
          <div className="space-y-2">
            <div className="w-full h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
              <div
                style={{ width: `${webPercentage}%` }}
                className="bg-blue-600 h-full transition-all"
                title={`Website Users: ${webPercentage}%`}
              />
              <div
                style={{ width: `${mobilePercentage}%` }}
                className="bg-indigo-500 h-full transition-all"
                title={`Mobile Users: ${mobilePercentage}%`}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                Website Users: {stats.webUsersCount} ({webPercentage}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                Mobile App Users: {stats.mobileUsersCount} ({mobilePercentage}%)
              </span>
            </div>
          </div>

          {/* Feature Quick Launch Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <Link
              to="/users?tab=web"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 transition-all flex items-start gap-3"
            >
              <IconGlobe size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Web Users Tab</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Inspect domains, servers & web sessions
                </div>
              </div>
            </Link>

            <Link
              to="/users?tab=mobile"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 transition-all flex items-start gap-3"
            >
              <IconSmartphone size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Mobile Users Tab</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Inspect devices, push tokens & fleet
                </div>
              </div>
            </Link>

            <Link
              to="/announcements"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 transition-all flex items-start gap-3"
            >
              <IconMegaphone size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Announcements</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Broadcast push notices to all apps
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Mobile Device Fleet Breakdown */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <IconSmartphone size={16} className="text-indigo-500" />
              Mobile App Fleet
            </h2>
            <Link to="/mobile-fleet" className="text-xs text-blue-500 font-semibold hover:underline">
              Fleet Details →
            </Link>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IconApple size={18} className="text-slate-800 dark:text-slate-200" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Apple iOS Devices</div>
                  <div className="text-[10px] text-slate-400">APNs Push Enabled</div>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{stats.iosDevicesCount}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IconAndroid size={18} className="text-emerald-500" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Google Android</div>
                  <div className="text-[10px] text-slate-400">FCM Push Enabled</div>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{stats.androidDevicesCount}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IconShield size={18} className="text-blue-500" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Version Enforcement</div>
                  <div className="text-[10px] text-slate-400">Target: v1.2.0 Latest</div>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Enforced</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Platform Inventory & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monitored Assets Summary */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <IconGlobe size={16} className="text-blue-500" />
              Website Infrastructure Assets
            </h2>
            <Link to="/domains" className="text-xs text-blue-500 font-semibold hover:underline">
              View All Domains →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Healthy Active Domains</span>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.activeDomains}
              </div>
              <span className="text-[10px] text-slate-400">Auto-renew & SSL secured</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Expiring Soon (&lt;30d)</span>
              <div className="text-xl font-bold text-amber-500 mt-1">
                {stats.expiringSoonDomains}
              </div>
              <span className="text-[10px] text-slate-400">Alerts active</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Web Applications</span>
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {stats.totalApplications ?? 724}
              </div>
              <span className="text-[10px] text-slate-400">Live services & APIs</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Registrar Accounts</span>
              <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
                {stats.totalProviders ?? 93}
              </div>
              <span className="text-[10px] text-slate-400">Connected providers</span>
            </div>
          </div>
        </div>

        {/* Live Admin Audit Activity */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <IconActivity size={16} className="text-emerald-500" />
              Recent Platform Audit Events
            </h2>
            <Link to="/audit-logs" className="text-xs text-blue-500 font-semibold hover:underline">
              Full Audit Trail →
            </Link>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {stats.recentAuditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white font-mono text-[11px]">
                    {log.action}
                  </span>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    {log.details}
                  </p>
                </div>
                <span className="text-slate-400 text-[10px] whitespace-nowrap font-mono ml-4">
                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
