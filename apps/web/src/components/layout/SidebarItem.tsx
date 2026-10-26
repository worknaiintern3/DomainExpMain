import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NavItem } from '@/types';

interface CustomIcon {
  src: string;
  style?: React.CSSProperties;
}

export interface SidebarItemProps {
  item: NavItem;
  /** Icon-rail mode: hides the label and badge, keeps the icon with a tooltip. */
  collapsed?: boolean;
  onNavigate?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ item, collapsed = false, onNavigate }) => {
  const isCustomIcon = (icon: string | CustomIcon): icon is CustomIcon =>
    typeof icon === 'object' && icon !== null && 'src' in icon;

  return (
    <NavLink
      to={item.path}
      end={item.exact}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'flex items-center rounded-lg text-label-md transition-all duration-150 select-none group border',
          collapsed ? 'justify-center px-0 py-unit-sm' : 'justify-between px-unit-md py-unit-sm',
          isActive
            ? 'bg-primary/10 text-primary font-semibold border-primary/25 shadow-micro'
            : 'text-secondary hover:bg-surface-container-low hover:text-on-surface border-transparent'
        )
      }
    >
      <div className={`flex items-center min-w-0 ${collapsed ? '' : 'gap-unit-md'}`}>
        {isCustomIcon(item.icon) ? (
          <img
            src={item.icon.src}
            alt={item.label}
            className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform"
            style={item.icon.style}
          />
        ) : (
          <span className="material-symbols-outlined text-[20px] shrink-0 leading-none group-hover:scale-105 transition-transform">
            {item.icon}
          </span>
        )}
        {!collapsed && <span className="truncate font-sans text-label-md">{item.label}</span>}
      </div>

      {!collapsed && item.badge !== undefined && (
        <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-mono text-[10px] font-semibold">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
};
