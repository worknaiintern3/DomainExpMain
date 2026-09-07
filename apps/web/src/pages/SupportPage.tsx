import React, { useState, useRef } from 'react';
import {
  HelpCategory,
  HelpHeader,
  HelpSearchBar,
  HelpSidebarNav,
  QuickStartSection,
  StatusExplanationSection,
  DomainDataSpecsSection,
  DataSourcesSection,
  FeatureGuidesSection,
  MonitoringDisclosureCard,
  SecurityPrivacyCard,
  FaqSection,
  TroubleshootingSection,
  DataLimitationsSection,
  ProductMetadataFooter,
  HelpToast,
} from '@/features/help';

export const SupportPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<HelpCategory>('quick-start');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  const handleSearchFocus = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
    setActiveCategory('faq');
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = 0;
    }
  };

  const handleSelectCategory = (cat: HelpCategory) => {
    setActiveCategory(cat);
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = 0;
    }
  };

  const handleCopySnippet = (snippet: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(snippet);
    }
    setToastMessage(`Copied to clipboard: "${snippet}"`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const renderActiveCategoryContent = () => {
    switch (activeCategory) {
      case 'quick-start':
        return <QuickStartSection />;
      case 'status':
        return <StatusExplanationSection />;
      case 'domain-data':
        return <DomainDataSpecsSection />;
      case 'features':
        return <FeatureGuidesSection />;
      case 'data-sources':
        return <DataSourcesSection />;
      case 'monitoring':
        return <MonitoringDisclosureCard />;
      case 'security':
        return <SecurityPrivacyCard />;
      case 'faq':
        return <FaqSection searchFilter={searchQuery} />;
      case 'troubleshooting':
        return <TroubleshootingSection onCopySnippet={handleCopySnippet} />;
      case 'limitations':
        return <DataLimitationsSection />;
      default:
        return <QuickStartSection />;
    }
  };

  return (
    <div className="flex flex-col w-full lg:h-[calc(100vh-8.5rem)] min-h-0 pb-unit-md lg:pb-0">
      {/* 1. Page Header */}
      <div className="shrink-0">
        <HelpHeader
          onSearchFocus={handleSearchFocus}
          onDocumentationClick={() => handleSelectCategory('data-sources')}
        />
      </div>

      {/* 2. Search Help / Knowledge Base */}
      <div className="shrink-0 mt-unit-md">
        <HelpSearchBar
          inputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onQuickSearch={handleQuickSearch}
        />
      </div>

      {/* 3. Main Master-Detail Layout (Adaptive Flex Workspace) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-unit-lg items-stretch">
        {/* Left Sub-Navigation Rail */}
        <HelpSidebarNav
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
        />

        {/* Right Active Category Content Workspace (Dedicated Internal Scroll Viewport) */}
        <div
          ref={contentAreaRef}
          tabIndex={-1}
          className="flex-1 w-full min-w-0 flex flex-col lg:h-full lg:overflow-y-auto lg:overflow-x-hidden pr-1 lg:pr-2.5 outline-none pb-unit-lg"
        >
          {/* Subtle Horizontal Tab Transition Panel */}
          <div
            key={activeCategory}
            className="animate-help-tab-enter flex flex-col gap-unit-xl"
          >
            {renderActiveCategoryContent()}
            <ProductMetadataFooter />
          </div>
        </div>
      </div>

      {/* Micro-Feedback Toast */}
      <HelpToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </div>
  );
};

export default SupportPage;
