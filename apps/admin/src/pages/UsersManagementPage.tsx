import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminClient } from '../api/admin.client';
import {
  IconAlertTriangle,
  IconAndroid,
  IconApple,
  IconCheckCircle,
  IconExternalLink,
  IconGlobe,
  IconKey,
  IconLayers,
  IconLock,
  IconRefresh,
  IconSearch,
  IconServer,
  IconShield,
  IconSmartphone,
  IconUsers,
} from '../components/Icons';
import { UserDetailModal } from '../components/UserDetailModal';
import type { PlatformUser } from '../types/admin.types';

export const UsersManagementPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab: 'all' | 'web' | 'mobile'
  const currentTab = (searchParams.get('tab') as 'web' | 'mobile' | 'all') || 'all';

  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Selected User Modal
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Quick feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminClient.getUsers({
        type: currentTab,
      });
      setUsers(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentTab]);

  const setTab = (tab: 'web' | 'mobile' | 'all') => {
    setSearchParams({ tab });
  };

  // Filtered List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Tab filter
      if (
        currentTab === 'web' &&
        !(
          u.type === 'web' ||
          u.type === 'both' ||
          (u.webData?.domainsCount || 0) > 0 ||
          (u.webData?.applicationsCount || 0) > 0
        )
      ) {
        return false;
      }

      if (
        currentTab === 'mobile' &&
        !(
          u.type === 'mobile' ||
          u.type === 'both' ||
          (u.mobileData?.devicesCount || 0) > 0 ||
          (u.mobileData?.pushTokensCount || 0) > 0
        )
      ) {
        return false;
      }

      // Role filter
      if (roleFilter !== 'all' && u.platformRole.toLowerCase() !== roleFilter.toLowerCase()) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && u.status !== statusFilter) {
        return false;
      }

      // Plan filter
      if (planFilter !== 'all' && u.plan !== planFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = u.displayName?.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesDomain = u.webData?.topDomain?.toLowerCase().includes(q);
        const matchesDevice = u.mobileData?.devices?.some((d) =>
          d.deviceName.toLowerCase().includes(q),
        );
        const matchesId = u.id.toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesDomain || matchesDevice || matchesId;
      }

      return true;
    });
  }, [users, currentTab, roleFilter, statusFilter, planFilter, searchQuery]);

  // Tab-specific metrics calculations
  const metrics = useMemo(() => {
    const webUsers = users.filter(
      (u) =>
        u.type === 'web' ||
        u.type === 'both' ||
        (u.webData?.domainsCount || 0) > 0 ||
        (u.webData?.applicationsCount || 0) > 0,
    );
    const mobileUsers = users.filter(
      (u) =>
        u.type === 'mobile' ||
        u.type === 'both' ||
        (u.mobileData?.devicesCount || 0) > 0,
    );

    let totalDomains = 0;
    let totalServers = 0;
    let totalApplications = 0;
    let totalProviders = 0;

    users.forEach((u) => {
      totalDomains += u.webData?.domainsCount || 0;
      totalServers += u.webData?.serversCount || 0;
      totalApplications +=
        u.webData?.applicationsCount ?? u.webData?.applications?.length ?? 0;
      totalProviders +=
        u.webData?.providersCount ?? u.webData?.providerAccounts?.length ?? 0;
    });

    let iosCount = 0;
    let androidCount = 0;
    let pushEnabledCount = 0;
    mobileUsers.forEach((u) => {
      u.mobileData?.devices?.forEach((d) => {
        if (d.platform === 'ios') iosCount++;
        if (d.platform === 'android') androidCount++;
        if (d.token) pushEnabledCount++;
      });
    });

    return {
      totalWebUsers: webUsers.length,
      totalDomains,
      totalServers,
      totalApplications,
      totalProviders,
      totalMobileUsers: mobileUsers.length,
      iosCount,
      androidCount,
      pushEnabledCount,
      totalUsers: users.length,
    };
  }, [users]);

  const handleOpenUser = (user: PlatformUser) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleUserUpdated = (updatedUser: PlatformUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    setSelectedUser(updatedUser);
    setToastMessage(`Updated ${updatedUser.displayName || updatedUser.email}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUserDeleted = (deletedId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== deletedId));
    setIsModalOpen(false);
    setSelectedUser(null);
    setToastMessage('User deleted successfully.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleQuickToggleStatus = async (user: PlatformUser, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      const updated = await adminClient.toggleUserStatus(user.id, nextStatus);
      handleUserUpdated(updated);
    } catch (err: any) {
      alert(`Error toggling status: ${err?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <IconCheckCircle size={16} className="text-emerald-400 dark:text-emerald-600" />
          {toastMessage}
        </div>
      ) : null}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Users Management Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
              {filteredUsers.length} Users
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage all website domains, applications, cloud accounts, and mobile clients with unified real-time telemetry.
          </p>
        </div>

        {/* Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm"
          >
            <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* CORE FEATURE: DEDICATED TABS FOR ALL USERS, WEBSITE USERS & MOBILE USERS */}
      <div className="p-1 rounded-2xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-800 flex flex-wrap gap-1 shadow-inner">
        <button
          onClick={() => setTab('all')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            currentTab === 'all'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <IconUsers size={15} />
          <span>👥 All Platform Users ({metrics.totalUsers})</span>
        </button>

        <button
          onClick={() => setTab('web')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 ${
            currentTab === 'web'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
          }`}
        >
          <IconGlobe size={16} />
          <span>🌐 Website Users ({metrics.totalWebUsers})</span>
        </button>

        <button
          onClick={() => setTab('mobile')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 ${
            currentTab === 'mobile'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
          }`}
        >
          <IconSmartphone size={16} />
          <span>📱 Mobile Users ({metrics.totalMobileUsers})</span>
        </button>
      </div>

      {/* DYNAMIC KPI STRIP BASED ON SELECTED TAB */}
      {currentTab === 'web' ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IconGlobe size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Website Users</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.totalWebUsers}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconShield size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Domains Monitored</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.totalDomains}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <IconServer size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Infrastructure Nodes</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.totalServers}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <IconLayers size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Web Applications</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.totalApplications}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconKey size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Registrar Accounts</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.totalProviders}</div>
            </div>
          </div>
        </div>
      ) : currentTab === 'mobile' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <IconSmartphone size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Mobile App Installs</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.totalMobileUsers}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
              <IconApple size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">iOS Devices (APNs)</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.iosCount}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconAndroid size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Android Devices (FCM)</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.androidCount}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconCheckCircle size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Push Tokens Active</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{metrics.pushEnabledCount}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Platform Total Users</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{users.length}</div>
          </div>
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Website Accounts</span>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{metrics.totalWebUsers}</div>
          </div>
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Mobile App Accounts</span>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{metrics.totalMobileUsers}</div>
          </div>
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Web Applications</span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{metrics.totalApplications}</div>
          </div>
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Tracked Domains</span>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {metrics.totalDomains}
            </div>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTERS BAR */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <IconSearch
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder={
              currentTab === 'web'
                ? 'Search web users, emails, domains...'
                : currentTab === 'mobile'
                ? 'Search mobile users, devices (iPhone/Pixel)...'
                : 'Search all users by name, email, domain, ID...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">SUPER_ADMIN</option>
            <option value="admin">ADMIN</option>
            <option value="support">SUPPORT</option>
            <option value="user">USER</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Plans</option>
            <option value="Enterprise">Enterprise</option>
            <option value="Pro">Pro</option>
            <option value="Free">Free</option>
          </select>

          {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || planFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                setStatusFilter('all');
                setPlanFilter('all');
              }}
              className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold px-2 py-1"
            >
              Reset Filters
            </button>
          ) : null}
        </div>
      </div>

      {/* ERROR NOTICE */}
      {error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <IconAlertTriangle size={16} />
            {error}
          </span>
          <button onClick={fetchUsers} className="underline font-bold">
            Retry
          </button>
        </div>
      ) : null}

      {/* USERS DATA TABLE */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading user profiles and connected assets...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs space-y-2">
            <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
              No users match your criteria
            </p>
            <p className="text-slate-500">Try adjusting your search query, status or role filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-6">User / Account</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">
                    {currentTab === 'web'
                      ? 'Web Portfolio & Assets'
                      : currentTab === 'mobile'
                      ? 'Mobile Fleet & Devices'
                      : 'Connected Assets & Portfolio'}
                  </th>
                  <th className="py-3.5 px-4">Plan</th>
                  <th className="py-3.5 px-4">Last Active</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => handleOpenUser(user)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* User Identity Column */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-sm flex-shrink-0">
                          <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[10px] flex items-center justify-center font-bold text-xs text-slate-800 dark:text-white">
                            {user.displayName
                              ? user.displayName.slice(0, 2).toUpperCase()
                              : user.email.slice(0, 2).toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span>{user.displayName || user.email}</span>
                            {/* Platform badge */}
                            {user.type === 'both' ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                                Web + Mobile
                              </span>
                            ) : user.type === 'mobile' ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                                Mobile Only
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                                Web Only
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role Column */}
                    <td className="py-4 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          user.platformRole === 'SUPER_ADMIN'
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                            : user.platformRole === 'ADMIN'
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30'
                            : user.platformRole === 'SUPPORT'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {user.platformRole}
                      </span>
                    </td>

                    {/* Status Column */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          user.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {user.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>

                    {/* Context Asset Preview */}
                    <td className="py-4 px-4">
                      {currentTab === 'web' ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <IconGlobe size={13} className="text-blue-500" />
                            <span>{user.webData?.domainsCount || 0} Domains</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-600 dark:text-slate-300">{user.webData?.serversCount || 0} Servers</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span>Apps: {user.webData?.applicationsCount ?? user.webData?.applications?.length ?? 0}</span>
                            <span>•</span>
                            <span>Providers: {user.webData?.providersCount ?? user.webData?.providerAccounts?.length ?? 0}</span>
                          </div>
                        </div>
                      ) : currentTab === 'mobile' ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <IconSmartphone size={13} className="text-indigo-500" />
                            <span>{user.mobileData?.devicesCount || 0} Devices</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              v{user.mobileData?.latestAppVersion || 'None'}
                            </span>
                          </div>
                          {user.mobileData?.devices && user.mobileData.devices.length > 0 ? (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              {user.mobileData.devices[0].platform === 'ios' ? (
                                <IconApple size={12} />
                              ) : (
                                <IconAndroid size={12} />
                              )}
                              <span>{user.mobileData.devices[0].deviceName}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No mobile fleet device</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                          <div>
                            🌐 {user.webData?.domainsCount || 0} Domains • {user.webData?.serversCount || 0} Srv • {user.webData?.applicationsCount ?? user.webData?.applications?.length ?? 0} Apps
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <IconSmartphone size={11} className="text-indigo-500" />
                            <span>{user.mobileData?.devicesCount || 0} Mobile Devices (v{user.mobileData?.latestAppVersion || 'None'})</span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Plan Column */}
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30">
                        {user.plan}
                      </span>
                    </td>

                    {/* Last Login Column */}
                    <td className="py-4 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(user.lastLoginAt).toLocaleDateString()}{' '}
                      <span className="text-[10px] text-slate-400">
                        ({new Date(user.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </td>

                    {/* Action Column */}
                    <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenUser(user)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-semibold text-xs border border-blue-200 dark:border-blue-500/30 transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <span>Manage</span>
                          <IconExternalLink size={12} />
                        </button>

                        <button
                          onClick={(e) => handleQuickToggleStatus(user, e)}
                          title={user.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            user.status === 'active'
                              ? 'text-slate-400 hover:text-amber-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                              : 'text-emerald-500 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40'
                          }`}
                        >
                          <IconLock size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RENDER USER DETAIL MODAL */}
      {selectedUser && isModalOpen ? (
        <UserDetailModal
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedUser(null);
          }}
          onUserUpdated={handleUserUpdated}
          onUserDeleted={handleUserDeleted}
        />
      ) : null}
    </div>
  );
};
