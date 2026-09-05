import React from 'react';
import { Link } from 'react-router-dom';
import { RegistrarDiversityData } from '../overview.types';

interface RegistrarDiversityCardProps {
  data: RegistrarDiversityData;
}

export const RegistrarDiversityCard: React.FC<RegistrarDiversityCardProps> = ({ data }) => {
  return (
    <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-sm flex flex-col justify-between border border-outline-variant/40">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
            Registrar Diversity
          </span>
          <div className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            {data.registrarCount} Registrars
          </div>
        </div>
        <span className="material-symbols-outlined text-secondary text-[18px]">lan</span>
      </div>

      <div className="flex flex-col gap-unit-xs mt-unit-sm font-caption-xs text-caption-xs">
        {data.items.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors border border-outline-variant/20"
          >
            <div className="flex items-center gap-unit-xs">
              <span className={`w-2 h-2 rounded-full ${item.colorClass} shrink-0`} />
              <span className="font-medium text-on-surface">{item.name}</span>
            </div>
            <div className="flex items-center gap-unit-sm font-label-mono text-label-mono">
              <span className="text-on-surface font-semibold">{item.count}</span>
              <span className="text-secondary w-10 text-right">{item.percentage.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-unit-xs flex items-center justify-between font-caption-xs text-caption-xs text-secondary border-t border-surface-container mt-unit-xs">
        <span>
          Consolidation Score: <strong className="text-on-surface font-semibold">{data.consolidationScore}</strong>
        </span>
        <Link to="/pricing" className="text-primary hover:underline font-semibold">
          Analyze Transfers
        </Link>
      </div>
    </div>
  );
};
