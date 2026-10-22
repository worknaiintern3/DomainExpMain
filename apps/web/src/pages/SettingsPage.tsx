import React, { useEffect, useRef, useState } from 'react';
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
  ImportDataModal,
} from '@/features/settings';
import { useAuth } from '@/auth/AuthContext';
import { applyTheme, readThemePreference, saveThemePreference } from '@/lib/theme';
import {
  applyAppearancePreferences,
  loadAppearancePreferences,
  saveAppearancePreferences,
} from '@/lib/appearance';
import { loadPricingPreferences, savePricingPreferences } from '@/features/settings/pricing-preferences';
import { usePreferences } from '@/preferences/PreferencesContext';

type SavedSection = 'general' | 'portfolio' | 'discovery' | 'pricing' | 'appearance';
const SAVE_ORDER: readonly SavedSection[] = ['general', 'portfolio', 'discovery', 'pricing', 'appearance'];

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const preferences = usePreferences();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const [generalDirty, setGeneralDirty] = useState(false);
  const [portfolioDirty, setPortfolioDirty] = useState(false);
  const [discoveryDirty, setDiscoveryDirty] = useState(false);
  const [pricingDirty, setPricingDirty] = useState(false);
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const dirtyRef = useRef<Record<SavedSection, boolean>>({ general: false, portfolio: false, discovery: false, pricing: false, appearance: false });
  const revisionRef = useRef<Record<SavedSection, number>>({ general: 0, portfolio: 0, discovery: 0, pricing: 0, appearance: 0 });
  const savingRef = useRef(false);
  const [settings, setSettings] = useState<DomainPulseSettings>(() => ({
    ...DEFAULT_SETTINGS,
    appearance: { ...loadAppearancePreferences(), theme: readThemePreference() },
    pricing: loadPricingPreferences(),
  }));

  // Preview immediately; only Save remembers the choice on this device.
  useEffect(() => {
    applyTheme(settings.appearance.theme);
  }, [settings.appearance.theme]);

  // Density, rows, motion and sidebar preview immediately; Save remembers them on this device.
  useEffect(() => {
    applyAppearancePreferences(settings.appearance);
  }, [settings.appearance]);
  useEffect(() => () => {
    applyTheme(readThemePreference());
    applyAppearancePreferences(loadAppearancePreferences());
  }, []);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [toast, setToast] = useState<ToastData | null>(null);

  const hasUnsavedSettings = generalDirty || portfolioDirty || discoveryDirty || pricingDirty || appearanceDirty;

  useEffect(() => {
    if (!hasUnsavedSettings) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const warnBeforeInternalNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const element = event.target instanceof Element ? event.target : null;
      const link = element?.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash === window.location.hash
      ) {
        return;
      }

      if (!window.confirm('You have unsaved settings. Leave this page and discard them?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    document.addEventListener('click', warnBeforeInternalNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      document.removeEventListener('click', warnBeforeInternalNavigation, true);
    };
  }, [hasUnsavedSettings]);

  // Modals
  const [importModalConfig, setImportModalConfig] = useState<{
    isOpen: boolean;
    format: 'csv' | 'json';
  }>({ isOpen: false, format: 'csv' });

  const showToast = (message: string, description?: string, type?: 'success' | 'info' | 'error') => {
    setToast({ message, description, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Load the saved General settings into the editable draft (unless the user is mid-edit).
  useEffect(() => {
    if (preferences.status !== 'ready' || generalDirty) return;
    const saved = preferences.general;
    setSettings((prev) => ({
      ...prev,
      general: {
        dateFormat: saved.dateFormat,
        defaultLandingPage: saved.defaultLandingPage,
        displayName: saved.displayName ?? '',
        rowsPerPage: saved.rowsPerPage,
        timezone: saved.timezone,
        workspaceName: saved.workspaceName,
      },
    }));
  }, [preferences.status, preferences.general, generalDirty]);

  // Same for Portfolio settings.
  useEffect(() => {
    if (preferences.status !== 'ready' || portfolioDirty) return;
    setSettings((prev) => ({ ...prev, portfolio: preferences.portfolio }));
  }, [preferences.status, preferences.portfolio, portfolioDirty]);

  useEffect(() => {
    if (preferences.status !== 'ready' || discoveryDirty) return;
    setSettings((prev) => ({ ...prev, domainDiscovery: preferences.discovery }));
  }, [preferences.status, preferences.discovery, discoveryDirty]);

  const markDirty = (section: SavedSection) => {
    dirtyRef.current[section] = true;
    revisionRef.current[section] += 1;
    const setters = { general: setGeneralDirty, portfolio: setPortfolioDirty, discovery: setDiscoveryDirty, pricing: setPricingDirty, appearance: setAppearanceDirty };
    setters[section](true);
    setSaveState('unsaved');
  };

  const saveSections = async (sections: readonly SavedSection[]) => {
    if (savingRef.current) return;
    if (sections.length === 0) {
      showToast('Nothing to save', 'Your preferences are already up to date.', 'info');
      return;
    }
    if (sections.some((section) => section === 'general' || section === 'portfolio' || section === 'discovery') && preferences.status !== 'ready') {
      setSaveState('error');
      showToast('Account settings unavailable', 'Reload your saved settings before saving.', 'error');
      return;
    }
    if (sections.includes('general') && !settings.general.workspaceName.trim()) {
      setSaveState('error');
      showToast('Workspace name is required', 'Enter a workspace name before saving.', 'error');
      return;
    }
    const portfolio = settings.portfolio;
    if (sections.includes('portfolio') && !(
      Number.isInteger(portfolio.criticalThresholdDays) && portfolio.criticalThresholdDays >= 1 && portfolio.criticalThresholdDays <= 365 &&
      Number.isInteger(portfolio.warningThresholdDays) && portfolio.warningThresholdDays > portfolio.criticalThresholdDays && portfolio.warningThresholdDays <= 730
    )) {
      setSaveState('error');
      showToast('Invalid expiry horizons', 'Correct the Portfolio thresholds before saving.', 'error');
      return;
    }

    savingRef.current = true;
    setSaveState('saving');
    const revisions = { ...revisionRef.current };
    let activeSection: SavedSection = sections[0]!;
    try {
      for (const section of sections) {
        activeSection = section;
        switch (section) {
          case 'general': {
            const draft = settings.general;
            await preferences.saveGeneral({
              dateFormat: draft.dateFormat,
              defaultLandingPage: draft.defaultLandingPage,
              displayName: draft.displayName.trim() || null,
              rowsPerPage: draft.rowsPerPage,
              timezone: draft.timezone,
              workspaceName: draft.workspaceName.trim(),
            });
            break;
          }
          case 'portfolio':
            await preferences.savePortfolio(settings.portfolio);
            break;
          case 'discovery':
            await preferences.saveDiscovery(settings.domainDiscovery);
            break;
          case 'pricing':
            savePricingPreferences(settings.pricing);
            break;
          case 'appearance':
            saveAppearancePreferences(settings.appearance);
            saveThemePreference(settings.appearance.theme);
            break;
        }
        if (revisionRef.current[section] === revisions[section]) {
          dirtyRef.current[section] = false;
          const setters = { general: setGeneralDirty, portfolio: setPortfolioDirty, discovery: setDiscoveryDirty, pricing: setPricingDirty, appearance: setAppearanceDirty };
          setters[section](false);
        }
      }
      setSaveState(Object.values(dirtyRef.current).some(Boolean) ? 'unsaved' : 'saved');
      showToast('Preferences saved', 'Account settings and device preferences were saved where applicable.', 'success');
    } catch (error) {
      setSaveState('error');
      showToast(`Could not save ${activeSection} settings`, error instanceof Error && error.message ? error.message : 'Please try again.', 'error');
    } finally {
      savingRef.current = false;
    }
  };

  const handleSave = () => {
    void saveSections(SAVE_ORDER.filter((section) => dirtyRef.current[section]));
  };

  const handleResetDefaults = () => {
    if (savingRef.current) return;
    if (preferences.status !== 'ready') {
      showToast('Account settings unavailable', 'Reload your saved settings before resetting defaults.', 'error');
      return;
    }
    // Names are not "preferences": keep the current names, reset everything else.
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      appearance: { ...DEFAULT_SETTINGS.appearance },
      pricing: { ...DEFAULT_SETTINGS.pricing },
      general: {
        ...DEFAULT_SETTINGS.general,
        displayName: prev.general.displayName,
        workspaceName: prev.general.workspaceName,
      },
    }));
    for (const section of SAVE_ORDER) markDirty(section);
    showToast('Defaults restored', 'Click Save Preferences to apply them.', 'info');
  };

  const updateGeneralSettings = (partial: Partial<DomainPulseSettings['general']>) => {
    setSettings((prev) => ({
      ...prev,
      general: { ...prev.general, ...partial },
    }));
    markDirty('general');
  };

  const updatePortfolioSettings = (partial: Partial<DomainPulseSettings['portfolio']>) => {
    setSettings((prev) => ({
      ...prev,
      portfolio: { ...prev.portfolio, ...partial },
    }));
    markDirty('portfolio');
  };

  const updateDomainDiscoverySettings = (
    partial: Partial<DomainPulseSettings['domainDiscovery']>
  ) => {
    setSettings((prev) => ({
      ...prev,
      domainDiscovery: { ...prev.domainDiscovery, ...partial },
    }));
    markDirty('discovery');
  };

  const updatePricingSettings = (partial: Partial<DomainPulseSettings['pricing']>) => {
    setSettings((prev) => ({
      ...prev,
      pricing: { ...prev.pricing, ...partial },
    }));
    markDirty('pricing');
  };

  const updateAppearanceSettings = (partial: Partial<DomainPulseSettings['appearance']>) => {
    setSettings((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...partial },
    }));
    markDirty('appearance');
  };

  const handleImportDone = (message: string, description: string, type: 'success' | 'info' | 'error') => {
    showToast(message, description, type);
  };


  return (
    <div className="flex flex-col w-full pb-unit-2xl">
      {/* Settings Header */}
      <SettingsHeader
        saveState={saveState}
        onSave={handleSave}
        onResetDefaults={handleResetDefaults}
        currencyCode={settings.pricing.defaultCurrency}
        workspaceName={settings.general.workspaceName}
        densityLabel={settings.appearance.density}
      />

      <aside className="mt-unit-md rounded-lg border border-primary/25 bg-primary/5 px-unit-base py-unit-sm text-body-sm text-on-surface" role="note">
        General, Portfolio, Domain Discovery, Pricing, and Appearance preferences are saved on this device with the current backend. Changes to your display or workspace name here do not update your account. Alert rules and inventory transfers use live workspace data. Browser push requires server support; email and WhatsApp delivery are not available yet.
      </aside>

      {/* Settings Layout Body */}
      <div className="flex flex-col lg:flex-row gap-unit-lg mt-unit-lg items-start">
        {/* Left Column: Category Navigation Rail */}
        <SettingsSidebarNav
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          workspaceName={preferences.status === 'ready' ? preferences.general.workspaceName : settings.general.workspaceName}
          accountEmail={user?.email ?? ''}
        />

        {/* Right Column: Active Tab Panel */}
        <div className="flex-1 w-full min-w-0">
          {(['general', 'portfolio', 'domain-discovery'] as SettingsCategory[]).includes(activeCategory) && preferences.status !== 'ready' && (
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg" role={preferences.status === 'error' ? 'alert' : 'status'}>
              <p className="font-body-sm text-body-sm text-on-surface">
                {preferences.status === 'loading' ? 'Loading your saved account settings…' : 'Your saved account settings could not be loaded.'}
              </p>
              {preferences.status === 'error' && (
                <button type="button" onClick={() => void preferences.reload()} className="mt-unit-md h-9 rounded-lg bg-primary px-unit-md font-label-md text-label-md font-semibold text-on-primary hover:bg-tertiary">
                  Try again
                </button>
              )}
            </div>
          )}
          {activeCategory === 'general' && preferences.status === 'ready' && (
            <GeneralTab
              settings={settings.general}
              onChange={updateGeneralSettings}
              onSave={() => void saveSections(['general'])}
              isSaving={saveState === 'saving'}
            />
          )}

          {activeCategory === 'portfolio' && preferences.status === 'ready' && (
            <PortfolioTab
              settings={settings.portfolio}
              onChange={updatePortfolioSettings}
              onSave={() => void saveSections(['portfolio'])}
              isSaving={saveState === 'saving'}
            />
          )}

          {activeCategory === 'domain-discovery' && preferences.status === 'ready' && (
              <DomainDiscoveryTab
                settings={settings.domainDiscovery}
                onChange={updateDomainDiscoverySettings}
                onSave={() => void saveSections(['discovery'])}
                isSaving={saveState === 'saving'}
              />
          )}

          {activeCategory === 'alerts' && (
            <AlertsTab
              role={preferences.role}
            />
          )}

          {activeCategory === 'pricing' && (
            <PricingTab
              settings={settings.pricing}
              onChange={updatePricingSettings}
              onSave={() => void saveSections(['pricing'])}
              isSaving={saveState === 'saving'}
            />
          )}

          {activeCategory === 'appearance' && (
            <AppearanceTab
              settings={settings.appearance}
              onChange={updateAppearanceSettings}
              onSave={() => void saveSections(['appearance'])}
              isSaving={saveState === 'saving'}
            />
          )}

          {activeCategory === 'integrations' && <IntegrationsTab />}

          {activeCategory === 'data-management' && (
            <DataManagementTab
              onOpenImportModal={(format) =>
                setImportModalConfig({ isOpen: true, format })
              }
              notify={(message, description, type) => showToast(message, description, type)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <ImportDataModal
        isOpen={importModalConfig.isOpen}
        format={importModalConfig.format}
        onClose={() =>
          setImportModalConfig((prev) => ({ ...prev, isOpen: false }))
        }
        onImported={handleImportDone}
      />

      {/* Interactive Micro-Feedback Toast */}
      <SettingsToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};
