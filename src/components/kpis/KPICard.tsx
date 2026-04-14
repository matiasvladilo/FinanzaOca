'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaPositive?: boolean;
  icon: React.ReactNode;
  accent?: 'blue' | 'red' | 'green' | 'gray';
}

const ACCENT_BG: Record<string, string> = {
  blue:  'bg-blue-50 dark:bg-blue-950',
  red:   'bg-red-50 dark:bg-red-950',
  green: 'bg-green-50 dark:bg-green-950',
  gray:  'bg-gray-100 dark:bg-gray-800',
};

const ACCENT_ICON: Record<string, string> = {
  blue:  'text-blue-600 dark:text-blue-400',
  red:   'text-red-500 dark:text-red-400',
  green: 'text-green-600 dark:text-green-400',
  gray:  'text-gray-500 dark:text-gray-400',
};

const ACCENT_BORDER: Record<string, string> = {
  blue:  'border-l-blue-500',
  red:   'border-l-red-500',
  green: 'border-l-emerald-500',
  gray:  'border-l-gray-400',
};

export default function KPICard({
  label, value, sub, delta, deltaPositive, icon, accent = 'blue',
}: KPICardProps) {
  return (
    <div className={'bg-white dark:bg-gray-900 rounded-2xl p-4 lg:p-5 flex flex-col gap-3 border-l-[3px] border border-gray-100 dark:border-gray-800 ' + ACCENT_BORDER[accent]}
      style={{ boxShadow: 'var(--card-shadow)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">
          {label}
        </span>
        <div className={'w-8 h-8 rounded-xl flex items-center justify-center ' + ACCENT_BG[accent]}>
          <span className={ACCENT_ICON[accent]}>{icon}</span>
        </div>
      </div>

      <p className="text-[16px] sm:text-[22px] lg:text-[28px] font-bold leading-tight text-gray-900 dark:text-white break-words">
        {value}
      </p>

      <div className="flex items-center gap-1.5">
        {delta !== undefined && (
          deltaPositive
            ? <TrendingUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        )}
        <span className={
          'text-[11px] truncate ' + (
            delta !== undefined
              ? (deltaPositive
                  ? 'text-green-600 dark:text-green-400 font-semibold'
                  : 'text-red-500 font-semibold')
              : 'text-gray-400 dark:text-gray-500'
          )
        }>
          {sub ?? ''}
        </span>
      </div>
    </div>
  );
}
