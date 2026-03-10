'use client';

import { useState } from 'react';
import { X, BarChart3 } from 'lucide-react';

export default function AlertBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-4 relative">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
        <BarChart3 className="w-5 h-5 text-blue-600" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-blue-700 mb-1">Meticulous Analysis Insight</p>
        <p className="text-[12px] text-gray-600 leading-relaxed">
          Detección de varianza granular identifica el{' '}
          <span className="text-blue-600 font-semibold">52.1%</span> del Factor Index en la sucursal{' '}
          <strong>PV</strong> como un outlier estadísticamente significativo. La correlación con el
          peak del jueves sugiere cuellos de botella logísticos durante carga máxima.
        </p>
      </div>

      {/* Close */}
      <button
        onClick={() => setVisible(false)}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
