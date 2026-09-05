import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NavItem } from '@/types';

export interface SidebarItemProps {
  item: NavItem;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ item }) => {
  return (
    <NavLink
      to={item.path}
      end={item.exact}
      className={({ isActive }) =>
        clsx(
          'flex items-center justify-between px-unit-md py-unit-sm rounded-lg text-label-md transition-all duration-150 select-none group',
          isActive
            ? 'bg-primary-container text-on-primary font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]'
            : 'text-secondary-fixed-dim hover:bg-white/[0.06] hover:text-on-primary'
        )
      }
    >
      <div className="flex items-center gap-unit-md min-w-0">
        <span className="material-symbols-outlined text-[20px] shrink-0 leading-none group-hover:scale-105 transition-transform">
          {item.icon}
        </span>
        <span className="truncate font-sans text-label-md">{item.label}</span>
      </div>

      {item.badge !== undefined && (
        <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white font-mono text-[10px] font-semibold">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
};
