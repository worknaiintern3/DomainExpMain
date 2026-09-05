import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchEntry {
  title: string;
  category: 'Domains' | 'Servers' | 'Websites' | 'Accounts' | 'Navigation';
  path: string;
  icon: string;
  subtext: string;
}

const SEARCH_ITEMS: SearchEntry[] = [
  { title: 'Overview', category: 'Navigation', path: '/overview', icon: 'grid_view', subtext: 'Portfolio summary and health metrics' },
  { title: 'My Domains', category: 'Domains', path: '/domains', icon: 'language', subtext: '42 domains in tracking' },
  { title: 'VPS & Servers', category: 'Servers', path: '/servers', icon: 'dns', subtext: '6 active server nodes' },
  { title: 'Websites & Apps', category: 'Websites', path: '/websites', icon: 'web', subtext: '18 deployed applications' },
  { title: 'Accounts & Emails', category: 'Accounts', path: '/accounts', icon: 'alternate_email', subtext: 'Linked provider accounts' },
  { title: 'Find Domain', category: 'Navigation', path: '/find-domain', icon: 'search', subtext: 'Multi-TLD availability checker' },
  { title: 'Price Comparison', category: 'Navigation', path: '/pricing', icon: 'payments', subtext: 'Registrar & hosting cost comparison' },
  { title: 'Alerts & Monitoring', category: 'Navigation', path: '/alerts', icon: 'notifications', subtext: 'Expiry and status alerts' },
  { title: 'Infrastructure Map', category: 'Navigation', path: '/infrastructure-map', icon: 'hub', subtext: 'Interactive relationship topology' },
  { title: 'Settings', category: 'Navigation', path: '/settings', icon: 'settings', subtext: 'Workspace preferences' },
  { title: 'Help & Support', category: 'Navigation', path: '/support', icon: 'help', subtext: 'Documentation and guides' },
];

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open triggered by parent if wired
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = SEARCH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()) ||
      item.subtext.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
      <div
        className="w-full max-w-xl rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-modal overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Field */}
        <div className="flex items-center px-unit-md py-unit-sm border-b border-outline-variant/40 gap-unit-sm bg-surface-container-lowest">
          <span className="material-symbols-outlined text-secondary text-[20px]">search</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search domains, servers, websites, emails, IPs..."
            className="w-full h-9 bg-transparent text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[10px] text-secondary border border-outline-variant/40">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-unit-xs flex flex-col gap-0.5">
          {filtered.length === 0 ? (
            <div className="p-unit-lg text-center text-secondary font-body-sm text-body-sm">
              No matching assets or views found.
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleSelect(item.path)}
                className="flex items-center justify-between p-unit-sm rounded-lg hover:bg-surface-container text-left transition-colors group"
              >
                <div className="flex items-center gap-unit-sm min-w-0">
                  <span className="material-symbols-outlined text-[18px] text-secondary group-hover:text-primary transition-colors">
                    {item.icon}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-md text-label-md text-on-surface font-medium truncate group-hover:text-primary">
                      {item.title}
                    </span>
                    <span className="font-caption-xs text-caption-xs text-secondary truncate">
                      {item.subtext}
                    </span>
                  </div>
                </div>
                <span className="font-caption-xs text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-container text-secondary shrink-0">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-unit-md py-unit-xs bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between text-caption-xs font-caption-xs text-secondary">
          <span>Navigate with arrow keys or click to select</span>
          <span className="font-mono text-[10px]">DomainPulse Quick Navigation</span>
        </div>
      </div>
    </div>
  );
};
