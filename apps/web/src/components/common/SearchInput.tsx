import React from 'react';
import clsx from 'clsx';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showShortcut?: boolean;
  shortcutLabel?: string;
  onClear?: () => void;
  wrapperClassName?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = 'Search domains, servers, websites, emails, IPs...',
  showShortcut = true,
  shortcutLabel = '⌘K',
  onClear,
  wrapperClassName,
  className,
  value,
  onChange,
  ...props
}) => {
  return (
    <div className={clsx('relative flex items-center w-full', wrapperClassName)}>
      <span className="material-symbols-outlined absolute left-unit-sm text-on-surface-variant text-[18px] pointer-events-none select-none">
        search
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={clsx(
          'h-9 w-full pl-9 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm border border-outline-variant/60 shadow-micro placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all',
          showShortcut ? 'pr-14' : 'pr-4',
          className
        )}
        {...props}
      />
      {showShortcut && !value && (
        <span className="absolute right-2 font-caption-xs text-[10px] text-on-surface-variant px-1.5 py-0.5 rounded bg-surface-container font-mono border border-outline-variant/40 pointer-events-none select-none">
          {shortcutLabel}
        </span>
      )}
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 text-secondary hover:text-on-surface transition-colors p-0.5 rounded"
          aria-label="Clear search"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  );
};
