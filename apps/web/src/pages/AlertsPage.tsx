import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertItem,
  AlertRuleItem,
  AlertSeverity,
  AlertViewMode,
  HealthMatrixItem,
  INITIAL_ALERTS,
  INITIAL_HEALTH_MATRIX,
  INITIAL_MONITORING_COVERAGE,
  INITIAL_ALERT_RULES,
  RENEWAL_HORIZONS,
  AlertsHeader,
  AlertSummaryStrip,
  ActiveAlertsFeed,
  AlertInspectorDrawer,
  PortfolioHealthMatrix,
  MonitoringCoverageSection,
  AlertRulesSection,
  AlertRuleModal,
  AlertsEmptyState,
} from '../features/alerts';

export const AlertsPage: React.FC = () => {
  const navigate = useNavigate();

  // Primary State
  const [viewMode, setViewMode] = useState<AlertViewMode>('feed');
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [rules, setRules] = useState<AlertRuleItem[]>(INITIAL_ALERT_RULES);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>('alert-1');

  // Filter State
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'ALL'>('ALL');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedRegistrar, setSelectedRegistrar] = useState<string>('');

  // Modal State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<AlertRuleItem | null>(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2800);
  };

  // Filter Counts Calculation
  const counts = useMemo(() => {
    return {
      all: alerts.length,
      critical: alerts.filter((a) => a.severity === 'CRITICAL').length,
      warning: alerts.filter((a) => a.severity === 'WARNING').length,
      upcoming: alerts.filter((a) => a.severity === 'UPCOMING').length,
      resolved: alerts.filter((a) => a.severity === 'RESOLVED').length,
      unread: alerts.filter((a) => a.status === 'unread').length,
    };
  }, [alerts]);

  // Summary Strip Metrics
  const summaryMetrics = useMemo(() => {
    return {
      criticalCount: counts.critical,
      warningCount: counts.warning,
      upcomingCount: counts.upcoming,
      resolvedCount: counts.resolved,
      unreadCount: counts.unread,
      trackedDomainsCount: 42,
      notificationDeliveryStatus: 'Configuration Only',
    };
  }, [counts]);

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Severity Filter
      if (severityFilter !== 'ALL' && alert.severity !== severityFilter) {
        return false;
      }
      // Unread Only
      if (unreadOnly && alert.status !== 'unread') {
        return false;
      }
      // Type Filter
      if (selectedType && alert.type !== selectedType) {
        return false;
      }
      // Registrar Filter
      if (selectedRegistrar && !alert.registrarOrProvider.toLowerCase().includes(selectedRegistrar.toLowerCase())) {
        return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDomain = alert.domain.toLowerCase().includes(q);
        const matchTitle = alert.title.toLowerCase().includes(q);
        const matchInsight = alert.riskInsight.toLowerCase().includes(q);
        const matchProvider = alert.registrarOrProvider.toLowerCase().includes(q);
        const matchType = alert.type.toLowerCase().includes(q);
        if (!matchDomain && !matchTitle && !matchInsight && !matchProvider && !matchType) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, severityFilter, unreadOnly, selectedType, selectedRegistrar, searchQuery]);

  // Critical Action Cards
  const criticalCards = useMemo(() => {
    return alerts.filter(
      (a) => a.severity === 'CRITICAL' && (a.isCriticalActionCard || a.daysRemaining <= 7)
    );
  }, [alerts]);

  // Selected Alert
  const selectedAlert = useMemo(() => {
    return alerts.find((a) => a.id === selectedAlertId) || alerts[0] || null;
  }, [alerts, selectedAlertId]);

  // Handlers
  const handleSelectAlert = (alert: AlertItem) => {
    setSelectedAlertId(alert.id);
    // Mark as read in-memory if unread
    if (alert.status === 'unread') {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, status: 'read' } : a))
      );
    }
  };

  const handleMarkAllRead = () => {
    setAlerts((prev) =>
      prev.map((a) => (a.status === 'unread' ? { ...a, status: 'read' } : a))
    );
    showToast(`Marked ${counts.unread} alerts as read`);
  };

  const handleSetReminder = (alert: AlertItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showToast(`Reminder scheduled for ${alert.domain} (24h prior)`);
  };

  const handleMarkResolved = (alert: AlertItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, status: 'resolved', severity: 'RESOLVED' } : a))
    );
    showToast(`Alert for ${alert.domain} marked as resolved`);
  };

  const handleNavigateToEntity = (route: string) => {
    navigate(route);
  };

  const handleResetFilters = () => {
    setSeverityFilter('ALL');
    setUnreadOnly(false);
    setSearchQuery('');
    setSelectedType('');
    setSelectedRegistrar('');
  };

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === ruleId) {
          const next = !r.enabled;
          showToast(`Rule "${r.name}" ${next ? 'enabled' : 'disabled'}`);
          return { ...r, enabled: next };
        }
        return r;
      })
    );
  };

  const handleOpenAddNewRule = () => {
    setEditingRule(null);
    setIsRuleModalOpen(true);
  };

  const handleEditRule = (rule: AlertRuleItem) => {
    setEditingRule(rule);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = (savedRule: AlertRuleItem) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === savedRule.id);
      if (exists) {
        return prev.map((r) => (r.id === savedRule.id ? savedRule : r));
      }
      return [savedRule, ...prev];
    });
    setIsRuleModalOpen(false);
    showToast(`Alert rule "${savedRule.name}" saved`);
  };

  const handleInspectMatrixItem = (item: HealthMatrixItem) => {
    showToast(`Inspecting health records for ${item.domain}`);
    if (item.targetRoute) {
      navigate(item.targetRoute);
    }
  };

  return (
    <div className="flex flex-col gap-unit-lg pb-unit-2xl">
      {/* 1. Header with Operational View Controller */}
      <AlertsHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeAlertsCount={alerts.length}
        healthMatrixCount={INITIAL_HEALTH_MATRIX.length}
        unreadCount={counts.unread}
        onMarkAllRead={handleMarkAllRead}
        onOpenRulesModal={handleOpenAddNewRule}
      />

      {/* 2. Summary Metric Strip (Shown on Feed, Matrix, Coverage, Rules views) */}
      {viewMode !== 'empty' && (
        <AlertSummaryStrip
          metrics={summaryMetrics}
          onSelectSeverity={(sev) => {
            setSeverityFilter(sev);
            if (viewMode !== 'feed') {
              setViewMode('feed');
            }
          }}
        />
      )}

      {/* 3. Primary Workspace Views */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-unit-lg items-start">
        {/* Tab 1: Active Alerts Feed (2-Column Master Detail with Inspector Drawer) */}
        {viewMode === 'feed' && (
          <>
            <div className="xl:col-span-8 flex flex-col gap-unit-lg min-w-0">
              <ActiveAlertsFeed
                alerts={filteredAlerts}
                criticalCards={criticalCards}
                renewalHorizons={RENEWAL_HORIZONS}
                selectedAlertId={selectedAlertId}
                onSelectAlert={handleSelectAlert}
                onSetReminder={handleSetReminder}
                onMarkResolved={handleMarkResolved}
                severityFilter={severityFilter}
                onSeverityChange={setSeverityFilter}
                unreadOnly={unreadOnly}
                onToggleUnread={() => setUnreadOnly((prev) => !prev)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                selectedRegistrar={selectedRegistrar}
                onRegistrarChange={setSelectedRegistrar}
                counts={counts}
                onResetFilters={handleResetFilters}
              />
            </div>

            {/* Right Sticky Inspector Drawer */}
            <div className="xl:col-span-4 flex flex-col gap-unit-md min-w-0">
              <AlertInspectorDrawer
                alert={selectedAlert}
                onSetReminder={handleSetReminder}
                onMarkResolved={handleMarkResolved}
                onNavigateToEntity={handleNavigateToEntity}
              />
            </div>
          </>
        )}

        {/* Tab 2: Domain Health Matrix (Full Width) */}
        {viewMode === 'matrix' && (
          <div className="xl:col-span-12 w-full flex flex-col gap-unit-lg min-w-0">
            <PortfolioHealthMatrix
              items={INITIAL_HEALTH_MATRIX}
              onInspect={handleInspectMatrixItem}
            />
          </div>
        )}

        {/* Tab 3: Monitoring Coverage (Full Width) */}
        {viewMode === 'coverage' && (
          <div className="xl:col-span-12 w-full flex flex-col gap-unit-lg min-w-0">
            <MonitoringCoverageSection
              coverageItems={INITIAL_MONITORING_COVERAGE}
              onConfigureIntegration={(item) =>
                showToast(`Viewing configuration for ${item.assetType}`)
              }
            />
          </div>
        )}

        {/* Tab 4: Alert Rules (Full Width) */}
        {viewMode === 'rules' && (
          <div className="xl:col-span-12 w-full flex flex-col gap-unit-lg min-w-0">
            <AlertRulesSection
              rules={rules}
              onToggleRule={handleToggleRule}
              onEditRule={handleEditRule}
              onAddNewRule={handleOpenAddNewRule}
            />
          </div>
        )}

        {/* Tab 5: Empty State Preview (Full Width) */}
        {viewMode === 'empty' && (
          <div className="xl:col-span-12 w-full flex flex-col gap-unit-lg min-w-0">
            <AlertsEmptyState
              trackedDomainsCount={summaryMetrics.trackedDomainsCount}
              onBackToFeed={() => setViewMode('feed')}
              onConfigureRules={() => setViewMode('rules')}
            />
          </div>
        )}
      </div>

      {/* 4. Alert Rule Modal */}
      <AlertRuleModal
        isOpen={isRuleModalOpen}
        rule={editingRule}
        onClose={() => setIsRuleModalOpen(false)}
        onSave={handleSaveRule}
      />

      {/* 5. Micro Toast Notification Popup */}
      <div
        className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 pointer-events-none ${
          toastMessage
            ? 'translate-y-0 opacity-100'
            : 'translate-y-20 opacity-0'
        }`}
      >
        <div className="flex items-center gap-unit-xs px-unit-md py-unit-sm rounded-lg bg-inverse-surface text-inverse-on-surface shadow-xl font-body-sm text-body-sm border border-outline-variant/30">
          <span className="material-symbols-outlined text-[18px] text-primary">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      </div>
    </div>
  );
};
export default AlertsPage;
