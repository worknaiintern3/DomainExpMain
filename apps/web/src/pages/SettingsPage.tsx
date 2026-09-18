import React, { useState } from 'react';
import {
  SettingsCategory,
  SaveState,
  DomainPulseSettings,
  DEFAULT_SETTINGS,
  SettingsHeader,
  SettingsSidebarNav,
  SettingsToast,
  ToastData,
  GeneralTab,
  PortfolioTab,
  DomainDiscoveryTab,
  AlertsTab,
  PricingTab,
  AppearanceTab,
  IntegrationsTab,
  DataManagementTab,
  ResetConfirmModal,
  ImportDataModal,
  ChannelConfigModal,
} from '@/features/settings';

export const SettingsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const [settings, setSettings] = useState<DomainPulseSettings>(DEFAULT_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [toast, setToast] = useState<ToastData | null>(null);

  // Modals
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [importModalConfig, setImportModalConfig] = useState<{
    isOpen: boolean;
    format: 'csv' | 'json';
  }>({ isOpen: false, format: 'csv' });
  const [channelConfigModal, setChannelConfigModal] = useState<{
    isOpen: boolean;
    channel: 'email' | 'whatsapp';
  }>({ isOpen: false, channel: 'email' });

  const showToast = (message: string, description?: string, type?: 'success' | 'info' | 'error') => {
    setToast({ message, description, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const handleSave = () => {
    setSaveState('saving');
    setTimeout(() => {
      setSaveState('saved');
      showToast(
        'Preferences saved successfully',
        'Preferences stored in local demo session',
        'success'
      );
    }, 600);
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    setSaveState('saved');
    showToast('Default preferences restored', 'All 7 categories restored to standard values', 'info');
  };

  const updateGeneralSettings = (partial: Partial<DomainPulseSettings['general']>) => {
    setSettings((prev) => ({
      ...prev,
      general: { ...prev.general, ...partial },
    }));
    setSaveState('unsaved');
  };

  const updatePortfolioSettings = (partial: Partial<DomainPulseSettings['portfolio']>) => {
    setSettings((prev) => ({
      ...prev,
      portfolio: { ...prev.portfolio, ...partial },
    }));
    setSaveState('unsaved');
  };

  const updateDomainDiscoverySettings = (
    partial: Partial<DomainPulseSettings['domainDiscovery']>
  ) => {
    setSettings((prev) => ({
      ...prev,
      domainDiscovery: { ...prev.domainDiscovery, ...partial },
    }));
    setSaveState('unsaved');
  };

  const updateAlertsSettings = (partial: Partial<DomainPulseSettings['alerts']>) => {
    setSettings((prev) => ({
      ...prev,
      alerts: { ...prev.alerts, ...partial },
    }));
    setSaveState('unsaved');
  };

  const updatePricingSettings = (partial: Partial<DomainPulseSettings['pricing']>) => {
    setSettings((prev) => ({
      ...prev,
      pricing: { ...prev.pricing, ...partial },
    }));
    setSaveState('unsaved');
  };

  const updateAppearanceSettings = (partial: Partial<DomainPulseSettings['appearance']>) => {
    setSettings((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...partial },
    }));
    setSaveState('unsaved');
  };

  const handleExport = (format: 'csv' | 'json') => {
    showToast(
      `Exporting 42 domain records to ${format.toUpperCase()}...`,
      'File download initiated in demo session',
      'info'
    );
  };

  const handleCreateBackup = () => {
    showToast(
      'Local session backup created successfully',
      'In-memory snapshot of 42 domains and active settings stored',
      'success'
    );
  };

  const handleRestoreBackup = () => {
    showToast(
      'Latest backup restored into demo session',
      'Loaded saved preferences from local demo session',
      'success'
    );
  };

  const handleResetDemoData = () => {
    setSettings(DEFAULT_SETTINGS);
    setSaveState('saved');
    showToast('Demo dataset reloaded (42 domains)', 'Standard reference inventory restored', 'info');
  };

  const handleConfirmResetWorkspace = () => {
    setSettings(DEFAULT_SETTINGS);
    setSaveState('saved');
    showToast(
      'Workspace demo data reset complete',
      'All preferences reset to baseline configuration',
      'info'
    );
  };

  const handleImportSuccess = (format: 'csv' | 'json', count: number) => {
    showToast(
      `Imported ${count} domain records from ${format.toUpperCase()}`,
      'Parsed successfully into demo session inventory',
      'success'
    );
  };

  const handleChannelSave = (addressOrPhone: string) => {
    showToast(
      `Channel preference updated: ${addressOrPhone}`,
      'Stored as local demo preference (External delivery not connected)',
      'info'
    );
  };

  return (
    <div className="flex flex-col w-full pb-unit-2xl">
      {/* Settings Header */}
      <SettingsHeader
        saveState={saveState}
        onSave={handleSave}
        onResetDefaults={handleResetDefaults}
        currencyCode={settings.general.defaultCurrency}
        densityLabel={settings.appearance.density}
      />

      <aside className="mt-unit-md rounded-lg border border-primary/25 bg-primary/5 px-unit-base py-unit-sm text-body-sm text-on-surface" role="note">
        <strong>Local interface preview.</strong>{' '}
        These settings, imports, backups, alerts, pricing, and delivery controls are not connected to a backend preferences service and affect only this demo session.
      </aside>

      {/* Settings Layout Body */}
      <div className="flex flex-col lg:flex-row gap-unit-lg mt-unit-lg items-start">
        {/* Left Column: Category Navigation Rail */}
        <SettingsSidebarNav
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        {/* Right Column: Active Tab Panel */}
        <div className="flex-1 w-full min-w-0">
          {activeCategory === 'general' && (
            <GeneralTab
              settings={settings.general}
              onChange={updateGeneralSettings}
              onSave={handleSave}
              isSaving={saveState === 'saving'}
            />
          )}

          {activeCategory === 'portfolio' && (
            <PortfolioTab
              settings={settings.portfolio}
              onChange={updatePortfolioSettings}
              onSave={handleSave}
              isSaving={saveState === 'saving'}
            />
          )}

          {activeCategory === 'domain-discovery' && (
            <DomainDiscoveryTab
              settings={settings.domainDiscovery}
              onChange={updateDomainDiscoverySettings}
              onSave={handleSave}
              isSaving={saveState === 'saving'}
            />
          )}

          {activeCategory === 'alerts' && (
            <AlertsTab
              settings={settings.alerts}
              onChange={updateAlertsSettings}
              onSave={handleSave}
              isSaving={saveState === 'saving'}
              onOpenChannelConfig={(channel) =>
                setChannelConfigModal({ isOpen: true, channel })
              }
            />
          )}

          {activeCategory === 'pricing' && (
            <PricingTab
              settings={settings.pricing}
              onChange={updatePricingSettings}
              onSave={handleSave}
              isSaving={saveState === 'saving'}
            />
          )}

          {activeCategory === 'appearance' && (
            <AppearanceTab
              settings={settings.appearance}
              onChange={updateAppearanceSettings}
              onSave={handleSave}
              isSaving={saveState === 'saving'}
            />
          )}

          {activeCategory === 'integrations' && <IntegrationsTab />}

          {activeCategory === 'data-management' && (
            <DataManagementTab
              onOpenImportModal={(format) =>
                setImportModalConfig({ isOpen: true, format })
              }
              onExport={handleExport}
              onCreateBackup={handleCreateBackup}
              onRestoreBackup={handleRestoreBackup}
              onResetDemoData={handleResetDemoData}
              onOpenResetConfirmModal={() => setIsResetModalOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmResetWorkspace}
      />

      <ImportDataModal
        isOpen={importModalConfig.isOpen}
        format={importModalConfig.format}
        onClose={() =>
          setImportModalConfig((prev) => ({ ...prev, isOpen: false }))
        }
        onImport={handleImportSuccess}
      />

      <ChannelConfigModal
        isOpen={channelConfigModal.isOpen}
        channel={channelConfigModal.channel}
        onClose={() =>
          setChannelConfigModal((prev) => ({ ...prev, isOpen: false }))
        }
        onSave={handleChannelSave}
      />

      {/* Interactive Micro-Feedback Toast */}
      <SettingsToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};
