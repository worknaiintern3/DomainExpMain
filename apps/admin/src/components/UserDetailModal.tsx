import React, { useEffect, useState } from 'react';
import { adminClient } from '../api/admin.client';
import type { PlatformRole, PlatformUser, UserPlan } from '../types/admin.types';
import {
  IconActivity,
  IconAlertTriangle,
  IconAndroid,
  IconApple,
  IconBell,
  IconCheckCircle,
  IconCopy,
  IconExternalLink,
  IconGlobe,
  IconKey,
  IconLayers,
  IconLock,
  IconLogOut,
  IconSend,
  IconServer,
  IconShield,
  IconSmartphone,
  IconTrash,
  IconUser,
} from './Icons';

interface Props {
  user: PlatformUser;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: PlatformUser) => void;
  onUserDeleted: (userId: string) => void;
}

export type TabType = 'overview' | 'web' | 'apps' | 'providers' | 'mobile' | 'audit' | 'actions';

export const UserDetailModal: React.FC<Props> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
  onUserDeleted,
}) => {
  const [currentUser, setCurrentUser] = useState<PlatformUser>(user);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copiedId, setCopiedId] = useState(false);

  // Management Form states
  const [role, setRole] = useState<PlatformRole>(user.platformRole);
  const [plan, setPlan] = useState<UserPlan>(user.plan);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [suspendReason, setSuspendReason] = useState(user.suspendReason || '');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Send Notification state
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifChannel, setNotifChannel] = useState<'all' | 'push' | 'email'>('all');
  const [showSendModal, setShowSendModal] = useState(false);

  // Synchronize initial user state & fetch detailed user data
  useEffect(() => {
    setCurrentUser(user);
    setRole(user.platformRole);
    setPlan(user.plan);
    setDisplayName(user.displayName);
    setSuspendReason(user.suspendReason || '');

    let isMounted = true;
    setIsLoadingDetail(true);
    adminClient
      .getUserById(user.id)
      .then((detailed) => {
        if (isMounted && detailed) {
          setCurrentUser(detailed);
          setRole(detailed.platformRole);
          setPlan(detailed.plan);
          setDisplayName(detailed.displayName);
          setSuspendReason(detailed.suspendReason || '');
        }
      })
      .catch((err) => {
        console.warn('Could not load detailed user object:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDetail(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user.id]);

  if (!isOpen) return null;

  const copyUserId = () => {
    navigator.clipboard.writeText(currentUser.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    try {
      const updated = await adminClient.updateUser(currentUser.id, {
        displayName: displayName.trim(),
        platformRole: role,
        plan,
      });
      setCurrentUser(updated);
      onUserUpdated(updated);
      setActionSuccessMsg('User profile & permissions updated successfully.');
    } catch (err: any) {
      setActionErrorMsg(err?.message || 'Failed to update profile');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    setActionLoading(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    try {
      const nextStatus = currentUser.status === 'active' ? 'suspended' : 'active';
      const updated = await adminClient.toggleUserStatus(
        currentUser.id,
        nextStatus,
        nextStatus === 'suspended' ? suspendReason || 'Administrative suspension' : undefined,
      );
      setCurrentUser(updated);
      onUserUpdated(updated);
      setActionSuccessMsg(
        nextStatus === 'suspended'
          ? 'User account has been suspended.'
          : 'User account has been restored to active status.',
      );
    } catch (err: any) {
      setActionErrorMsg(err?.message || 'Failed to change status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (
      !window.confirm(
        'Revoke all active web and mobile sessions for this user? They will be immediately logged out.',
      )
    ) {
      return;
    }
    setActionLoading(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    try {
      await adminClient.revokeUserSessions(currentUser.id);
      const updatedUser: PlatformUser = {
        ...currentUser,
        webData: {
          ...currentUser.webData,
          activeSessionsCount: 0,
          activeSessions:
            currentUser.webData.activeSessions?.map((s) => ({
              ...s,
              isRevoked: true,
            })) || [],
        },
      };
      setCurrentUser(updatedUser);
      onUserUpdated(updatedUser);
      setActionSuccessMsg('All active user sessions were revoked immediately.');
    } catch (err: any) {
      setActionErrorMsg(err?.message || 'Failed to revoke sessions');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;
    setActionLoading(true);
    try {
      await adminClient.sendUserNotification(currentUser.id, {
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        channel: notifChannel,
      });
      setShowSendModal(false);
      setNotifTitle('');
      setNotifMessage('');
      setActionSuccessMsg('Direct notification successfully dispatched to user.');
    } catch (err: any) {
      setActionErrorMsg(err?.message || 'Failed to send notification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    const confirmation = window.prompt(
      `To permanently delete this user, type their email address "${currentUser.email}":`,
    );
    if (confirmation !== currentUser.email) {
      alert('Email confirmation did not match. Deletion cancelled.');
      return;
    }

    setActionLoading(true);
    try {
      await adminClient.deleteUser(currentUser.id);
      onUserDeleted(currentUser.id);
      onClose();
    } catch (err: any) {
      setActionErrorMsg(err?.message || 'Failed to delete user');
      setActionLoading(false);
    }
  };

  const webData = currentUser.webData || {
    domainsCount: 0,
    serversCount: 0,
    applicationsCount: 0,
    providersCount: 0,
    activeSessionsCount: 0,
    domains: [],
    servers: [],
    applications: [],
    providerAccounts: [],
    workspaces: [],
    activeSessions: [],
  };

  const mobileData = currentUser.mobileData || {
    devicesCount: 0,
    pushTokensCount: 0,
    latestAppVersion: 'None',
    devices: [],
    notifications: [],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-5xl my-4 sm:my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[88vh] max-h-[900px]">
        {/* Header Modal Bar */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-md flex-shrink-0">
              <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center font-bold text-sm text-slate-800 dark:text-white">
                {currentUser.displayName
                  ? currentUser.displayName.slice(0, 2).toUpperCase()
                  : currentUser.email.slice(0, 2).toUpperCase()}
              </div>
            </div>

            {/* User Title & Badges */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {currentUser.displayName || currentUser.email}
                </h2>

                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    currentUser.status === 'active'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      currentUser.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  {currentUser.status === 'active' ? 'Active Account' : 'Suspended'}
                </span>

                {/* Role Badge */}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
                  {currentUser.platformRole}
                </span>

                {/* Plan Badge */}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30">
                  {currentUser.plan} Tier
                </span>

                {/* Platform Badge */}
                {currentUser.type === 'both' ? (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 flex items-center gap-1">
                    <IconGlobe size={13} />
                    <span>+</span>
                    <IconSmartphone size={13} />
                    <span>Web & Mobile</span>
                  </span>
                ) : currentUser.type === 'mobile' ? (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 flex items-center gap-1">
                    <IconSmartphone size={13} />
                    <span>Mobile App User</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 flex items-center gap-1">
                    <IconGlobe size={13} />
                    <span>Website User</span>
                  </span>
                )}
              </div>

              {/* Email & ID */}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="font-mono">{currentUser.email}</span>
                <span>•</span>
                <button
                  onClick={copyUserId}
                  className="flex items-center gap-1 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  title="Copy User ID"
                >
                  <IconCopy size={13} />
                  <span className="font-mono text-[11px]">{currentUser.id.slice(0, 16)}...</span>
                  {copiedId ? (
                    <span className="text-emerald-500 text-[10px] font-bold">Copied!</span>
                  ) : null}
                </button>
                <span>•</span>
                <span>Registered: {new Date(currentUser.createdAt).toLocaleDateString()}</span>
                {isLoadingDetail ? (
                  <span className="text-[10px] text-blue-500 font-semibold flex items-center gap-1 animate-pulse">
                    <span>Syncing latest data...</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Action Alerts */}
        {actionSuccessMsg ? (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between flex-shrink-0">
            <span className="flex items-center gap-2">
              <IconCheckCircle size={16} />
              {actionSuccessMsg}
            </span>
            <button onClick={() => setActionSuccessMsg(null)} className="text-xs font-bold">
              ✕
            </button>
          </div>
        ) : null}

        {actionErrorMsg ? (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between flex-shrink-0">
            <span className="flex items-center gap-2">
              <IconAlertTriangle size={16} />
              {actionErrorMsg}
            </span>
            <button onClick={() => setActionErrorMsg(null)} className="text-xs font-bold">
              ✕
            </button>
          </div>
        ) : null}

        {/* Dynamic Multi-Tab Navigation */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 backdrop-blur flex items-center gap-2 overflow-x-auto flex-shrink-0 min-h-[58px] py-2.5 z-10">
          {/* Tab 1: Overview */}
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <IconUser size={15} />
            <span>Overview & Profile</span>
          </button>

          {/* Tab 2: Domains & Servers */}
          <button
            onClick={() => setActiveTab('web')}
            className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              activeTab === 'web'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <IconGlobe size={15} />
            <span>Domains & Servers</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'web'
                  ? 'bg-white/20 text-white font-bold'
                  : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/40 dark:border-slate-700/60'
              }`}
            >
              {webData.domainsCount} Dom • {webData.serversCount} Srv
            </span>
          </button>

          {/* Tab 3: Websites & Applications */}
          <button
            onClick={() => setActiveTab('apps')}
            className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              activeTab === 'apps'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <IconLayers size={15} />
            <span>Websites & Apps</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'apps'
                  ? 'bg-white/20 text-white font-bold'
                  : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/40 dark:border-slate-700/60'
              }`}
            >
              {webData.applicationsCount ?? webData.applications?.length ?? 0}
            </span>
          </button>

          {/* Tab 4: Connected Registrar Accounts */}
          <button
            onClick={() => setActiveTab('providers')}
            className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              activeTab === 'providers'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <IconKey size={15} />
            <span>Registrar Accounts</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'providers'
                  ? 'bg-white/20 text-white font-bold'
                  : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/40 dark:border-slate-700/60'
              }`}
            >
              {webData.providersCount ?? webData.providerAccounts?.length ?? 0}
            </span>
          </button>

          {/* Tab 5: Mobile App Data */}
          <button
            onClick={() => setActiveTab('mobile')}
            className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              activeTab === 'mobile'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <IconSmartphone size={15} />
            <span>Mobile App Data</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'mobile'
                  ? 'bg-white/20 text-white font-bold'
                  : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/40 dark:border-slate-700/60'
              }`}
            >
              {mobileData.devicesCount} Devices
            </span>
          </button>

          {/* Tab 6: Audit Trail */}
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <IconActivity size={15} />
            <span>Activity & Audit</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'audit'
                  ? 'bg-white/20 text-white font-bold'
                  : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/40 dark:border-slate-700/60'
              }`}
            >
              {currentUser.auditLogs?.length || 0}
            </span>
          </button>

          {/* Tab 7: Admin Controls */}
          <button
            onClick={() => setActiveTab('actions')}
            className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              activeTab === 'actions'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <IconShield size={15} />
            <span>Admin Controls & Security</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Comprehensive 6-Card Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Domains */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Domains</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {webData.domainsCount}
                  </p>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate block">
                    {webData.topDomain || 'None'}
                  </span>
                </div>

                {/* 2. Servers */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Servers</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {webData.serversCount}
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {webData.serversCount > 0 ? 'Healthy' : 'None'}
                  </span>
                </div>

                {/* 3. Websites & Applications */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Web Apps</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {webData.applicationsCount ?? webData.applications?.length ?? 0}
                  </p>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                    {(webData.applicationsCount ?? 0) > 0 ? 'Configured' : 'None'}
                  </span>
                </div>

                {/* 4. Connected Providers */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Providers</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {webData.providersCount ?? webData.providerAccounts?.length ?? 0}
                  </p>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Registrars & DNS
                  </span>
                </div>

                {/* 5. Mobile Devices */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Mobile Devices</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {mobileData.devicesCount}
                  </p>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                    v{mobileData.latestAppVersion}
                  </span>
                </div>

                {/* 6. Active Sessions */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sessions</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {webData.activeSessionsCount}
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Active Token
                  </span>
                </div>
              </div>

              {/* Workspaces & Organizations List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-100/60 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                    Associated Workspaces ({webData.workspaces?.length || 0})
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Cross-workspace asset sharing & team access
                  </span>
                </div>

                {webData.workspaces && webData.workspaces.length > 0 ? (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {webData.workspaces.map((ws) => (
                      <div key={ws.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{ws.name}</span>
                            <span
                              className={`px-2 py-0.2 rounded-full text-[10px] font-semibold border ${
                                ws.role === 'Personal' || ws.role === 'Owner'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {ws.role}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            ID: {ws.id}
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-slate-400">
                          {ws.createdAt ? new Date(ws.createdAt).toLocaleDateString() : 'Active'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    Primary Workspace: {currentUser.personalWorkspaceId}
                  </div>
                )}
              </div>

              {/* User Detailed Metadata Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-100/60 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-300">
                  Account Credentials & Authentication Details
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  <div className="grid grid-cols-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400">Unique User ID (UUID)</span>
                    <span className="col-span-2 font-mono text-slate-800 dark:text-slate-200">{currentUser.id}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400">Account Email</span>
                    <span className="col-span-2 font-mono text-slate-800 dark:text-slate-200">{currentUser.email}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400">Display Name</span>
                    <span className="col-span-2 text-slate-800 dark:text-slate-200">{currentUser.displayName || 'Not specified'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400">Personal Workspace ID</span>
                    <span className="col-span-2 font-mono text-slate-800 dark:text-slate-200">{currentUser.personalWorkspaceId}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400">Platform Access Role</span>
                    <span className="col-span-2 font-semibold text-blue-600 dark:text-blue-400">{currentUser.platformRole}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400">Subscription Tier</span>
                    <span className="col-span-2 text-slate-800 dark:text-slate-200">{currentUser.plan} Subscription</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400">Last Observed IP & Location</span>
                    <span className="col-span-2 font-mono text-slate-800 dark:text-slate-200">{currentUser.lastLoginIp || 'Unknown'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400">Account Creation Date</span>
                    <span className="col-span-2 text-slate-800 dark:text-slate-200">{new Date(currentUser.createdAt).toUTCString()}</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-3">
                    <span className="text-slate-500 dark:text-slate-400">Last Profile Update</span>
                    <span className="col-span-2 text-slate-800 dark:text-slate-200">{new Date(currentUser.updatedAt).toUTCString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 2: DOMAINS & SERVERS */}
          {activeTab === 'web' ? (
            <div className="space-y-6">
              {/* Domains Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconGlobe size={16} className="text-blue-500" />
                    Monitored Domains Portfolio ({webData.domains?.length || 0})
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Live WHOIS, DNS & SSL tracking across all linked workspaces
                  </span>
                </div>

                {webData.domains && webData.domains.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/60 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-4">Domain Name</th>
                            <th className="py-2.5 px-3">Registrar</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">SSL Certificate</th>
                            <th className="py-2.5 px-3">Expires On</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                          {webData.domains.map((dom) => (
                            <tr key={dom.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4 font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                <span>{dom.domainName}</span>
                                <a
                                  href={`https://${dom.domainName}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-slate-400 hover:text-blue-500"
                                >
                                  <IconExternalLink size={12} />
                                </a>
                              </td>
                              <td className="py-3 px-3 font-medium">{dom.registrarName}</td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    dom.status === 'active'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                                      : dom.status === 'expiring'
                                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                                      : dom.status === 'expired'
                                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {dom.status}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 w-fit border ${
                                    dom.sslStatus === 'valid'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                                      : dom.sslStatus === 'expiring'
                                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                                  }`}
                                >
                                  <IconLock size={10} />
                                  {dom.sslStatus === 'valid' ? 'Valid SSL' : dom.sslStatus === 'expiring' ? 'Expiring Soon' : 'Invalid / Expired'}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px]">
                                {dom.expiresAt ? new Date(dom.expiresAt).toLocaleDateString() : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                    No domains monitored under this user's account.
                  </div>
                )}
              </div>

              {/* Servers Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <IconServer size={16} className="text-cyan-500" />
                  Monitored Infrastructure & Servers ({webData.servers?.length || 0})
                </h3>

                {webData.servers && webData.servers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {webData.servers.map((srv) => (
                      <div
                        key={srv.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-slate-900 dark:text-white">{srv.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                            {srv.uptimePercent}% Uptime
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
                          <span>IP: {srv.primaryIp || srv.host}</span>
                          {srv.providerLabel ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-sans font-medium">
                              {srv.providerLabel}
                            </span>
                          ) : null}
                        </div>
                        {srv.operatingSystem ? (
                          <div className="text-[10px] text-slate-400">
                            OS: {srv.operatingSystem}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                    No servers configured for this user.
                  </div>
                )}
              </div>

              {/* Active Web Sessions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconActivity size={16} className="text-emerald-500" />
                    Web Sessions ({webData.activeSessions?.filter((s) => !s.isRevoked).length || 0} active)
                  </h3>
                  <button
                    onClick={handleRevokeSessions}
                    disabled={actionLoading}
                    className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <IconLogOut size={13} />
                    Revoke All Sessions
                  </button>
                </div>

                {webData.activeSessions && webData.activeSessions.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 text-xs max-h-60 overflow-y-auto">
                    {webData.activeSessions.map((sess) => (
                      <div key={sess.id} className="p-3.5 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{sess.userAgent || 'Chrome 129 / Web App'}</span>
                            {sess.isRevoked ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                                REVOKED
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono mt-0.5">
                            IP: {sess.ipAddress || '127.0.0.1'} • Started: {new Date(sess.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                    No active web sessions recorded.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* TAB 3: WEBSITES & APPLICATIONS */}
          {activeTab === 'apps' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconLayers size={16} className="text-indigo-500" />
                    Websites & Applications ({webData.applications?.length || 0})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Web applications, microservices, and deployments registered under this user's workspaces.
                  </p>
                </div>
              </div>

                {webData.applications && webData.applications.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/60 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-4">Application</th>
                          <th className="py-2.5 px-3">Kind / Stack</th>
                          <th className="py-2.5 px-3">Primary URL</th>
                          <th className="py-2.5 px-3">Deployment / Notes</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                        {webData.applications.map((app) => (
                          <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {app.name}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 uppercase">
                                {app.kind || 'Web App'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {app.primaryUrl ? (
                                <a
                                  href={app.primaryUrl.startsWith('http') ? app.primaryUrl : `https://${app.primaryUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                                >
                                  <span>{app.primaryUrl}</span>
                                  <IconExternalLink size={11} />
                                </a>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No URL assigned</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                              {app.notes || 'Production'}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {app.state || 'Active'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">
                              {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                  No web applications or services linked to this user's account yet.
                </div>
              )}
            </div>
          ) : null}

          {/* TAB 4: CONNECTED REGISTRAR & CLOUD ACCOUNTS */}
          {activeTab === 'providers' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconKey size={16} className="text-amber-500" />
                    Connected Registrar & Cloud Provider Accounts ({webData.providerAccounts?.length || 0})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    DNS registrars, nameservers, and cloud providers synced with DomainPulse.
                  </p>
                </div>
              </div>

              {webData.providerAccounts && webData.providerAccounts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {webData.providerAccounts.map((prov) => (
                    <div
                      key={prov.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2.5 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 uppercase">
                          {prov.providerKey}
                        </span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {prov.label || prov.providerKey}
                        </h4>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 truncate">
                          Ext ID: {prov.externalAccountId || 'Default'}
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800 flex justify-between">
                        <span>Connected:</span>
                        <span>{prov.createdAt ? new Date(prov.createdAt).toLocaleDateString() : 'Active'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                  No registrar or cloud provider accounts configured for this user.
                </div>
              )}
            </div>
          ) : null}

          {/* TAB 5: MOBILE APP DATA */}
          {activeTab === 'mobile' ? (
            <div className="space-y-6">
              {/* Registered Devices */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconSmartphone size={16} className="text-indigo-500" />
                    Registered Mobile Devices & Fleet ({mobileData.devices?.length || 0})
                  </h3>
                  <button
                    onClick={() => setShowSendModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <IconSend size={13} />
                    Send Push to User
                  </button>
                </div>

                {mobileData.devices && mobileData.devices.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mobileData.devices.map((device) => (
                      <div
                        key={device.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-3 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                              {device.platform === 'ios' ? <IconApple size={18} /> : <IconAndroid size={18} />}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                {device.deviceName}
                              </h4>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                                {device.platform} OS
                              </span>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
                            v{device.appVersion}
                          </span>
                        </div>

                        {/* Push Token Status */}
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
                          <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center justify-between mb-1">
                            <span>Push Token Status:</span>
                            <span className="text-emerald-500 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Registered
                            </span>
                          </div>
                          <span className="text-slate-600 dark:text-slate-300 break-all">
                            {device.token ? `${device.token.slice(0, 24)}...` : 'Device Token Active'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex justify-between">
                          <span>Last Active Mobile Session:</span>
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {new Date(device.lastSeenAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                    This user has not linked or signed in from the DomainPulse Mobile App yet.
                  </div>
                )}
              </div>

              {/* Push Notifications History */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <IconBell size={16} className="text-amber-500" />
                  Push Notifications Delivered to this User
                </h3>

                {mobileData.notifications && mobileData.notifications.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 text-xs max-h-60 overflow-y-auto">
                    {mobileData.notifications.map((notif) => (
                      <div key={notif.id} className="p-3.5 flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {notif.title}
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 text-xs mt-0.5">
                            {notif.message}
                          </div>
                          <div className="text-slate-400 text-[10px] mt-1 font-mono">
                            {new Date(notif.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                          {notif.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                    No push notifications dispatched to this user yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* TAB 6: AUDIT TRAIL */}
          {activeTab === 'audit' ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <IconActivity size={16} className="text-blue-500" />
                Real-Time User Audit Trail
              </h3>

              {currentUser.auditLogs && currentUser.auditLogs.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 text-xs max-h-96 overflow-y-auto">
                  {currentUser.auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                            {log.action}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            Target: {log.target}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mt-1">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-slate-400 font-mono">
                        <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                        <div>{log.ipAddress || '127.0.0.1'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                  No audit log entries recorded for this user.
                </div>
              )}
            </div>
          ) : null}

          {/* TAB 7: ADMIN CONTROLS & SECURITY */}
          {activeTab === 'actions' ? (
            <div className="space-y-6">
              {/* Profile & Permissions Form */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-slate-50/60 dark:bg-slate-900/40">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <IconShield size={16} className="text-blue-500" />
                  Role & Account Privileges
                </h4>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Platform Role
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as PlatformRole)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="USER">USER (Standard Account)</option>
                        <option value="SUPPORT">SUPPORT (Tier-1 Access)</option>
                        <option value="ADMIN">ADMIN (Full Operations)</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN (Root Access)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Subscription Tier
                      </label>
                      <select
                        value={plan}
                        onChange={(e) => setPlan(e.target.value as UserPlan)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="Free">Free Tier</option>
                        <option value="Pro">Pro Plan</option>
                        <option value="Enterprise">Enterprise Plan</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
                    >
                      {actionLoading ? 'Saving...' : 'Save Privileges'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Status & Session Control */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-slate-50/60 dark:bg-slate-900/40 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <IconLock size={16} className="text-amber-500" />
                  Account Status & Access Suspension
                </h4>

                {currentUser.status === 'active' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Suspending this account immediately prevents the user from logging in to both the website and mobile app.
                    </p>
                    <input
                      type="text"
                      placeholder="Optional reason for suspension (e.g. Terms violation)..."
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={handleToggleStatus}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                    >
                      Suspend User Account
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                      Account is currently <strong>SUSPENDED</strong>. Reason: {currentUser.suspendReason || 'Administrative decision'}.
                    </div>
                    <button
                      onClick={handleToggleStatus}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                    >
                      Reactivate & Restore Access
                    </button>
                  </div>
                )}
              </div>

              {/* Danger Zone: Permanent Deletion */}
              <div className="border border-rose-200 dark:border-rose-900/40 rounded-xl p-5 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
                <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <IconTrash size={16} />
                  Danger Zone: Permanent Account Deletion
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  This action completely purges this user, their workspaces, domain relationships, push tokens, and mobile sessions. This operation cannot be reversed.
                </p>
                <button
                  onClick={handleDeleteUser}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <IconTrash size={13} />
                  Delete User Permanently
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
          <span>Unified User Center • DomainPulse Admin Hub</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>

      {/* Direct Push Dispatch Sub-modal */}
      {showSendModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <IconSend size={15} className="text-indigo-500" />
                Dispatch Direct Notification
              </h3>
              <button onClick={() => setShowSendModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient
                </label>
                <div className="px-3 py-2 text-xs rounded-lg bg-slate-100 dark:bg-slate-950 font-mono text-slate-600 dark:text-slate-400">
                  {currentUser.email} ({currentUser.displayName})
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notification Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical SSL Update"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message Body
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Type message content delivered to user device..."
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dispatch Channel
                </label>
                <select
                  value={notifChannel}
                  onChange={(e) => setNotifChannel(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Available Channels (Push + Email)</option>
                  <option value="push">Mobile Push Notification Only (APNs / FCM)</option>
                  <option value="email">Email Notification Only</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Dispatching...' : 'Dispatch Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
