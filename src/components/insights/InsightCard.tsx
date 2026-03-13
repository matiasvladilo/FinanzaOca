'use client';

import { TrendingUp, TrendingDown, Trophy, AlertTriangle, Info } from 'lucide-react';
import type { Insight } from '@/types/api';

const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string; badge: string }> = {
  positive: {
    border: 'border-green-200 dark:border-green-800',
    bg:     'bg-green-50 dark:bg-green-950/40',
    icon:   'text-green-600 dark:text-green-400',
    badge:  'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  },
  negative: {
    border: 'border-red-200 dark:border-red-800',
    bg:     'bg-red-50 dark:bg-red-950/40',
    icon:   'text-red-500 dark:text-red-400',
    badge:  'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  },
  warning: {
    border: 'border-amber-200 dark:border-amber-800',
    bg:     'bg-amber-50 dark:bg-amber-950/40',
    icon:   'text-amber-600 dark:text-amber-400',
    badge:  'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
  },
  neutral: {
    border: 'border-gray-200 dark:border-gray-700',
    bg:     'bg-gray-50 dark:bg-gray-800/40',
    icon:   'text-gray-500 dark:text-gray-400',
    badge:  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  },
};

function InsightIcon({ type, severity }: { type: Insight['type']; severity: Insight['severity'] }) {
  const cls = 'w-4 h-4 ' + (SEVERITY_STYLES[severity]?.icon ?? '');
  if (type === 'ranking')  return <Trophy className={cls} />;
  if (type === 'anomaly')  return <AlertTriangle className={cls} />;
  if (type === 'trend') {
    return (severity === 'positive')
      ? <TrendingUp className={cls} />
      : <TrendingDown className={cls} />;
  }
  return <Info className={cls} />;
}

interface InsightCardProps {
  insight: Insight;
}

const SEVERITY_LABEL: Record<string, string> = {
  positive: 'Positivo',
  negative: 'Alerta',
  warning:  'Atención',
  neutral:  'Info',
};

export default function InsightCard({ insight }: InsightCardProps) {
  const styles = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.neutral;

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${styles.border} ${styles.bg}`}>
      <div className="flex-shrink-0 mt-0.5">
        <InsightIcon type={insight.type} severity={insight.severity} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles.badge}`}>
            {SEVERITY_LABEL[insight.severity] ?? insight.severity}
          </span>
          {insight.local && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
              {insight.local}
            </span>
          )}
          {insight.delta !== undefined && (
            <span className={`text-[10px] font-bold ml-auto ${insight.delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {insight.delta > 0 ? '+' : ''}{insight.delta.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed">
          {insight.conclusion}
        </p>
      </div>
    </div>
  );
}
