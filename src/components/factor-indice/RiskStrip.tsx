'use client';

interface RiskStripProps {
  /** Mismas filas que consume el LineChart: { semana: string, [sucursal]: number | undefined }[] */
  data: Record<string, any>[];
  sucursales: string[];
  threshold?: number;
}

export default function RiskStrip({ data, sucursales, threshold = 60 }: RiskStripProps) {
  if (data.length === 0 || sucursales.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {sucursales.map(suc => (
        <div key={suc} className="flex items-center gap-2">
          <span className="text-[10px] font-medium w-16 flex-shrink-0 truncate" style={{ color: 'var(--text-3)' }}>
            {suc}
          </span>
          <div className="flex-1 flex gap-0.5">
            {data.map(row => {
              const idx = row[suc];
              const bg = idx === undefined ? 'var(--hover)' : idx <= threshold ? '#22C55E' : '#EF4444';
              return (
                <div key={row.semana} className="flex-1 h-2 rounded-sm" style={{ background: bg }}
                  title={`${row.semana}: ${idx !== undefined ? idx + '%' : 'sin dato'}`} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
