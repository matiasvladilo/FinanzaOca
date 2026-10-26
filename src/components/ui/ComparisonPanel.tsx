'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';

export interface CompMetric {
  label: string;
  valueA: number | null;
  valueB: number | null;
  format: (v: number) => string;
  higherIsBetter?: boolean; // default: true
}

interface Props {
  labelA: string;
  labelB: string;
  colorA?: string;
  colorB?: string;
  metrics: CompMetric[];
  loading?: boolean;
}

interface ChartRow {
  name: string;
  normA: number;
  normB: number;
  rawA: number | null;
  rawB: number | null;
  format: (v: number) => string;
  delta: number | null;
  isGood: boolean | null;
}

// Cada métrica se normaliza a su propio 0–100 (% del mayor entre A y B) para
// que Ventas/Gastos (pesos) y Margen % convivan en el mismo eje sin que uno
// aplaste al otro. El valor real se muestra como label sobre la barra y en
// el tooltip — el eje Y queda oculto porque la escala es relativa, no una
// magnitud en sí misma.
function buildRows(metrics: CompMetric[]): ChartRow[] {
  return metrics.map(m => {
    const a = m.valueA ?? 0;
    const b = m.valueB ?? 0;
    const maxVal = Math.max(Math.abs(a), Math.abs(b), 1);
    const delta = b === 0 ? null : ((a - b) / b) * 100;
    const isGood = delta === null ? null : (m.higherIsBetter !== false ? delta >= 0 : delta <= 0);
    return {
      name: m.label,
      normA: (a / maxVal) * 100,
      normB: (b / maxVal) * 100,
      rawA: m.valueA,
      rawB: m.valueB,
      format: m.format,
      delta, isGood,
    };
  });
}

// Las barras quedan angostas (3 métricas × 2 series en el mismo ancho que
// antes ocupaba 1), así que un monto completo ("$154.484.594") no entra
// centrado sin pisar la barra vecina. Arriba de la barra va una versión
// abreviada (M/k); el valor exacto siempre está en el tooltip al pasar el
// mouse — ninguna información se pierde, solo se reparte entre "de un
// vistazo" y "al detalle".
function abreviar(raw: number, format: (v: number) => string): string {
  const full = format(raw);
  if (full.length <= 7) return full; // ya es corto (ej. "38.0%", "4.1%")
  const abs = Math.abs(raw);
  const signo = raw < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${signo}$${Math.round(abs / 1_000)}k`;
  return full;
}

function renderBarLabel(rows: ChartRow[], which: 'rawA' | 'rawB') {
  return (props: any) => {
    const { x, y, width, height, index, value } = props;
    const row = rows[index];
    const raw = row[which];
    if (raw === null || raw === undefined || width == null) return null;
    const isNeg = value < 0;
    const ty = isNeg ? y + height + 14 : y - 6;
    return (
      <text x={x + width / 2} y={ty} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-2)">
        {abreviar(raw, row.format)}
      </text>
    );
  };
}

function CustomTooltip({ active, label, rows, colorA, colorB, labelA, labelB }: any) {
  if (!active) return null;
  const row: ChartRow | undefined = rows.find((r: ChartRow) => r.name === label);
  if (!row) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-[12px]"
      style={{ boxShadow: 'var(--card-shadow), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
      <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-2">{row.name}</p>
      <div className="flex items-center justify-between gap-6 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorA }} />
          <span className="text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{labelA}</span>
        </div>
        <span className="font-semibold flex-shrink-0" style={{ color: colorA }}>
          {row.rawA !== null ? row.format(row.rawA) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorB }} />
          <span className="text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{labelB}</span>
        </div>
        <span className="font-semibold flex-shrink-0" style={{ color: colorB }}>
          {row.rawB !== null ? row.format(row.rawB) : '—'}
        </span>
      </div>
      {row.delta !== null && (
        <p className="mt-2 pt-2 border-t text-[11px] font-medium"
          style={{ borderColor: 'var(--border)', color: row.isGood ? '#16a34a' : '#dc2626' }}>
          {Math.abs(row.delta) < 0.05 ? '→' : row.delta > 0 ? '↑' : '↓'}{' '}
          {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}% vs {labelB}
        </p>
      )}
    </div>
  );
}

export function ComparisonPanel({
  labelA, labelB,
  colorA = '#3B82F6',
  colorB = '#8B5CF6',
  metrics,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden animate-pulse"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="h-12" style={{ background: 'var(--hover)' }} />
        <div className="h-[220px] m-px" style={{ background: 'var(--hover)' }} />
      </div>
    );
  }

  const rows = buildRows(metrics);
  // Solo valores primitivos van al `data` del chart: Recharts reenvía los
  // campos "extra" de cada fila (como la función `format`) como atributos
  // DOM del <path> de la barra, lo que rompe el render. `rows` (con
  // format/rawA/rawB/delta) se usa aparte, por closure, en el tooltip y en
  // el label custom.
  const chartData = rows.map(r => ({ name: r.name, normA: r.normA, normB: r.normB }));
  const allNorm = rows.flatMap(r => [r.normA, r.normB]);
  const minNorm = Math.min(0, ...allNorm);
  const maxNorm = Math.max(100, ...allNorm);
  const yDomain: [number, number] = [minNorm - 18, maxNorm + 18];

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>

      {/* Header */}
      <div className="flex items-center text-[12px] font-semibold">
        <div className="flex-1 flex items-center gap-2.5 px-5 py-3"
          style={{ background: colorA + '14', borderBottom: `2px solid ${colorA}` }}>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorA }} />
          <span className="truncate" style={{ color: colorA }}>{labelA}</span>
        </div>
        <div className="px-4 py-3 flex-shrink-0 text-[16px]" style={{ color: 'var(--text-3)', background: 'var(--hover)' }}>⇄</div>
        <div className="flex-1 flex items-center justify-end gap-2.5 px-5 py-3"
          style={{ background: colorB + '14', borderBottom: `2px solid ${colorB}` }}>
          <span className="truncate text-right" style={{ color: colorB }}>{labelB}</span>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorB }} />
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-[220px] sm:h-[240px] px-2 pt-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="30%" barGap={4} margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} dy={6} />
            <YAxis hide domain={yDomain} />
            <Tooltip
              content={<CustomTooltip rows={rows} colorA={colorA} colorB={colorB} labelA={labelA} labelB={labelB} />}
              cursor={{ fill: 'var(--hover)', radius: 6 }}
            />
            <Bar dataKey="normA" name={labelA} fill={colorA} radius={[6, 6, 0, 0]} maxBarSize={48}>
              <LabelList dataKey="normA" content={renderBarLabel(rows, 'rawA')} />
            </Bar>
            <Bar dataKey="normB" name={labelB} fill={colorB} radius={[6, 6, 0, 0]} maxBarSize={48}>
              <LabelList dataKey="normB" content={renderBarLabel(rows, 'rawB')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Deltas — glanceables sin necesitar hover */}
      <div className="flex flex-wrap gap-2 px-5 pb-4 pt-1">
        {rows.map(r => r.delta !== null && (
          <span key={r.name}
            className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-1"
            style={{
              background: r.isGood ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: r.isGood ? '#16a34a' : '#dc2626',
            }}>
            {Math.abs(r.delta) < 0.05 ? '→' : r.delta > 0 ? '↑' : '↓'}{' '}
            {r.name}: {r.delta > 0 ? '+' : ''}{r.delta.toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  );
}
