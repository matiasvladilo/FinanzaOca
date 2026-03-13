'use client';

import InsightCard from './InsightCard';
import type { Insight } from '@/types/api';

interface InsightsPanelProps {
  insights: Insight[];
  loading?: boolean;
}

function InsightSkeleton() {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        </div>
      </div>
    </div>
  );
}

export default function InsightsPanel({ insights, loading }: InsightsPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="mb-4">
        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Insights del Período</h3>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
          Análisis automático · Tendencias · Rankings
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <InsightSkeleton />
          <InsightSkeleton />
          <InsightSkeleton />
        </div>
      ) : insights.length === 0 ? (
        <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center py-6">
          Selecciona un mes para ver insights del período
        </p>
      ) : (
        <div className="space-y-2.5">
          {insights.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
