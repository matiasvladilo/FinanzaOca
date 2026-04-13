'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts';
import {
  Search, Bell, Calendar, ChevronDown, MapPin,
  Download, TrendingUp, TrendingDown,
  DollarSign, ShoppingCart,
  BarChart2, Receipt, Activity, LayoutGrid, GitCompare, Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import { PeriodSelect } from '@/components/ui/PeriodSelect';
import { ComparisonPanel } from '@/components/ui/ComparisonPanel';
import { exportToCSV } from '@/lib/csv-export';
import { toast } from '@/components/ui/Toast';
import { getSucursalColor } from '@/config/sucursales';

// ─── tipos ───────────────────────────────────────────────
type Periodo = '7D' | '14D' | '30D';
type Metrica = 'ventas' | 'gastos' | 'ambos';
type TipoGrafico = 'area' | 'linea' | 'barras';
// ─── datos crudos por período (fallback sin conexión) ────
const rawData: Record<Periodo, { fecha: string; ventas: number; gastos: number }[]> = {
  '7D': [
    { fecha: 'Lun', ventas: 4800000, gastos: 2100000 },
    { fecha: 'Mar', ventas: 3900000, gastos: 1950000 },
    { fecha: 'Mié', ventas: 5200000, gastos: 2400000 },
    { fecha: 'Jue', ventas: 7100000, gastos: 3200000 },
    { fecha: 'Vie', ventas: 6400000, gastos: 2900000 },
    { fecha: 'Sáb', ventas: 8900000, gastos: 3600000 },
    { fecha: 'Dom', ventas: 6200000, gastos: 2700000 },
  ],
  '14D': [
    { fecha: 'Jun 17', ventas: 3600000, gastos: 1700000 },
    { fecha: 'Jun 18', ventas: 4200000, gastos: 1900000 },
    { fecha: 'Jun 19', ventas: 3800000, gastos: 1800000 },
    { fecha: 'Jun 20', ventas: 5100000, gastos: 2300000 },
    { fecha: 'Jun 21', ventas: 4700000, gastos: 2100000 },
    { fecha: 'Jun 22', ventas: 8200000, gastos: 3400000 },
    { fecha: 'Jun 23', ventas: 6100000, gastos: 2600000 },
    { fecha: 'Jun 24', ventas: 4800000, gastos: 2100000 },
    { fecha: 'Jun 25', ventas: 3900000, gastos: 1950000 },
    { fecha: 'Jun 26', ventas: 5200000, gastos: 2400000 },
    { fecha: 'Jun 27', ventas: 7100000, gastos: 3200000 },
    { fecha: 'Jun 28', ventas: 6400000, gastos: 2900000 },
    { fecha: 'Jun 29', ventas: 8900000, gastos: 3600000 },
    { fecha: 'Jun 30', ventas: 6200000, gastos: 2700000 },
  ],
  '30D': [
    { fecha: 'Jun 01', ventas: 3200000, gastos: 1500000 },
    { fecha: 'Jun 04', ventas: 3800000, gastos: 1750000 },
    { fecha: 'Jun 07', ventas: 3500000, gastos: 1600000 },
    { fecha: 'Jun 10', ventas: 4200000, gastos: 1900000 },
    { fecha: 'Jun 13', ventas: 3900000, gastos: 1800000 },
    { fecha: 'Jun 16', ventas: 3100000, gastos: 1450000 },
    { fecha: 'Jun 19', ventas: 5800000, gastos: 2600000 },
    { fecha: 'Jun 22', ventas: 7200000, gastos: 3200000 },
    { fecha: 'Jun 25', ventas: 6100000, gastos: 2700000 },
    { fecha: 'Jun 28', ventas: 4800000, gastos: 2100000 },
    { fecha: 'Jun 30', ventas: 6200000, gastos: 2700000 },
  ],
};



const fmt = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`;
const fmtFull = (v: number) => `$${v.toLocaleString('es-CL')}`;

// ─── Tipo fila del gráfico ────────────────────────────────
type ChartRow = {
  fecha: string; ventas: number; gastos: number;
  ventasComp?: number; gastosComp?: number; fechaComp?: string;
};
type MultiChartRow = Record<string, string | number>;
type LocalDef = { local: string; color: string; idx: number };
const LOCAL_COLORS = ['#2563EB', '#10B981', '#D97706', '#7C3AED']; // La Reina azul, PV verde, PT naranjo, Bilbao morado

// ─── Tooltip custom ──────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const main = payload.filter((p: any) => !String(p.dataKey).endsWith('Comp'));
  const comp = payload.filter((p: any) => String(p.dataKey).endsWith('Comp'));
  const fechaComp = payload[0]?.payload?.fechaComp;

  return (
    <div
      style={{
        background: 'rgba(10,14,28,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        padding: '10px 14px',
        minWidth: 195,
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 9, paddingBottom: 7, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.01em' }}>{label}</span>
      </div>

      {/* Período actual */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {main.map((p: any) => {
          const matchComp = comp.find((c: any) => c.name.replace(' Comp', '') === p.name || c.dataKey === p.dataKey + 'Comp');
          const delta = matchComp && matchComp.value > 0
            ? ((p.value - matchComp.value) / matchComp.value) * 100
            : null;
          const barColor = p.color ?? p.fill;
          return (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: barColor,
                  display: 'inline-block', flexShrink: 0,
                  boxShadow: `0 0 6px ${barColor}88`,
                }} />
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{p.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>{fmtFull(p.value)}</span>
                {delta !== null && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 20,
                    background: delta >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: delta >= 0 ? '#4ade80' : '#f87171',
                    letterSpacing: '-0.01em',
                  }}>
                    {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Período comparado */}
      {comp.length > 0 && (
        <>
          <div style={{ margin: '9px 0 7px', borderTop: '1px dashed rgba(255,255,255,0.07)', paddingTop: 7 }}>
            {fechaComp && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                vs {fechaComp}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {comp.map((p: any) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color ?? p.fill, opacity: 0.4, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{p.name.replace(' Comp', '')}</span>
                </div>
                <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>{fmtFull(p.value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Componente del gráfico interactivo ──────────────────
function InteractiveChart({
  data, metrica, tipo, hasComp, localDefs, localName, showPresupuesto,
}: {
  data: ChartRow[] | MultiChartRow[];
  metrica: Metrica;
  tipo: TipoGrafico;
  hasComp?: boolean;
  localDefs?: LocalDef[];
  localName?: string;
  showPresupuesto?: boolean;
}) {
  const yFmt = (v: number) => fmt(v);
  const showVentas = metrica === 'ventas' || metrica === 'ambos';
  const showGastos = metrica === 'gastos' || metrica === 'ambos';
  const isMulti = !!localDefs && localDefs.length >= 2;

  // Colores según local seleccionado (o defaults genéricos)
  const colorVentas = localName ? getSucursalColor(localName) : '#3B82F6';
  const colorGastos = localName ? getSucursalColor(localName) + 'AA' : '#EF4444';
  const isBar = tipo === 'barras';

  // Totales por local (solo modo multi)
  const mDataForTotals = isMulti ? data as MultiChartRow[] : [];
  const localTotals = isMulti ? localDefs!.map(d => ({
    ...d,
    ventas: mDataForTotals.reduce((s, r) => s + (((r[`ventas_${d.idx}`]) as number) ?? 0), 0),
    gastos: mDataForTotals.reduce((s, r) => s + (((r[`gastos_${d.idx}`]) as number) ?? 0), 0),
  })) : [];

  // ── Leyenda lateral ───────────────────────────────────────
  const SideLegend = () => (
    <div className="flex flex-col gap-3 justify-center pl-4 border-l" style={{ minWidth: 130, borderColor: 'var(--border)' }}>
      {isMulti ? (
        localTotals.map(d => (
          <div key={d.idx} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-2)' }}>{d.local}</span>
            </div>
            {showVentas && (
              <div className="text-[10px] pl-4 font-medium" style={{ color: d.color }}>
                V: {fmt(d.ventas)}
              </div>
            )}
            {showGastos && (
              <div className="text-[10px] pl-4" style={{ color: d.color, opacity: 0.65 }}>
                G: {fmt(d.gastos)}
              </div>
            )}
          </div>
        ))
      ) : (
        [
          ...(showVentas ? [{ key: 'v', color: colorVentas, label: 'Ventas' }] : []),
          ...(showGastos ? [{ key: 'g', color: colorGastos, label: 'Gastos' }] : []),
          ...(hasComp && showVentas ? [{ key: 'vc', color: colorVentas, label: 'Ventas comp.', dashed: true }] : []),
          ...(hasComp && showGastos ? [{ key: 'gc', color: colorGastos, label: 'Gastos comp.', dashed: true }] : []),
          ...(showPresupuesto ? [{ key: 'pres', color: '#EF4444', label: 'Presupuesto' }] : []),
        ].map(item => (
          <div key={item.key} className="flex items-center gap-2">
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 18 }}>
              {(item as { dashed?: boolean }).dashed ? (
                <svg width="18" height="8" viewBox="0 0 18 8">
                  <line x1="0" y1="4" x2="18" y2="4" stroke={item.color} strokeWidth="2" strokeDasharray="4 2" />
                </svg>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: item.color }} />
              )}
            </div>
            <span className="text-[11px] leading-tight" style={{ color: 'var(--text-3)' }}>{item.label}</span>
          </div>
        ))
      )}
    </div>
  );

  const barLabel = (key: string) => isBar ? (
    <LabelList dataKey={key} position="top"
      formatter={(v: unknown) => typeof v === 'number' && v > 0 ? fmt(v) : ''}
      style={{ fontSize: '9px', fill: 'var(--chart-axis)', fontWeight: 600 }} />
  ) : null;

  const commonChildren = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} tickFormatter={yFmt} width={52} />
      <Tooltip
        content={<CustomTooltip />}
        cursor={isBar
          ? { fill: 'rgba(255,255,255,0.04)', radius: 4 }
          : { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1, strokeDasharray: '4 3' }
        }
        wrapperStyle={{ outline: 'none' }}
        animationDuration={120}
      />
    </>
  );

  const wrap = (chart: React.ReactNode) => (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 min-w-0">{chart}</div>
      <div className="hidden sm:flex"><SideLegend /></div>
    </div>
  );

  // ── Modo multi-local: una serie por local ────────────────
  if (isMulti) {
    const mData = data as MultiChartRow[];
    if (tipo === 'area') return wrap(
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={mData} style={{ background: 'transparent' }}>
          <defs>
            {localDefs!.map(d => (
              <linearGradient key={d.idx} id={`gML${d.idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={d.color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={d.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {commonChildren}
          {localDefs!.flatMap(d => [
            showVentas && <Area key={`v${d.idx}`} type="monotone" dataKey={`ventas_${d.idx}`} name={d.local}
              stroke={d.color} strokeWidth={2.5} fill={`url(#gML${d.idx})`}
              dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />,
            showGastos && <Area key={`g${d.idx}`} type="monotone" dataKey={`gastos_${d.idx}`} name={`${d.local} Gastos`}
              stroke={d.color} strokeWidth={1.5} strokeDasharray="5 3" fill="none"
              dot={false} activeDot={{ r: 4 }} />,
          ])}
        </AreaChart>
      </ResponsiveContainer>
    );

    if (tipo === 'linea') return wrap(
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={mData} style={{ background: 'transparent' }}>
          {commonChildren}
          {localDefs!.flatMap(d => [
            showVentas && <Line key={`v${d.idx}`} type="monotone" dataKey={`ventas_${d.idx}`} name={d.local}
              stroke={d.color} strokeWidth={2.5}
              dot={{ r: 3, fill: d.color, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />,
            showGastos && <Line key={`g${d.idx}`} type="monotone" dataKey={`gastos_${d.idx}`} name={`${d.local} Gastos`}
              stroke={d.color} strokeWidth={1.5} strokeDasharray="5 3"
              dot={false} activeDot={{ r: 4 }} />,
          ])}
        </LineChart>
      </ResponsiveContainer>
    );

    return wrap(
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={mData} barCategoryGap="25%" barGap={2} margin={{ top: 22 }} style={{ background: 'transparent' }}>
          <defs>
            {localDefs!.map(d => (
              <pattern key={`hatch_${d.idx}`} id={`hatch_${d.idx}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={d.color} fillOpacity={0.15} />
                <line x1="0" y1="0" x2="0" y2="6" stroke={d.color} strokeWidth="2.5" strokeOpacity={0.75} />
              </pattern>
            ))}
          </defs>
          {commonChildren}
          {localDefs!.flatMap(d => [
            <Bar key={`v${d.idx}`} dataKey={`ventas_${d.idx}`} name={d.local}
              fill={d.color} opacity={showVentas ? 1 : 0} radius={[4, 4, 0, 0]}
              activeBar={{ fill: d.color, opacity: 0.85, filter: 'brightness(1.25)' }}>
              {showVentas ? barLabel(`ventas_${d.idx}`) : null}
            </Bar>,
            <Bar key={`g${d.idx}`} dataKey={`gastos_${d.idx}`} name={`${d.local} Gastos`}
              fill={showGastos ? `url(#hatch_${d.idx})` : d.color} opacity={showGastos ? 1 : 0} radius={[4, 4, 0, 0]}
              activeBar={{ fill: d.color, opacity: 0.75 }}>
              {showGastos ? barLabel(`gastos_${d.idx}`) : null}
            </Bar>,
            <Bar key={`pres${d.idx}`} dataKey={`presupuesto_${d.idx}`} name={`${d.local} Presup.`}
              fill="#EF4444" opacity={showPresupuesto ? 0.55 : 0} radius={[4, 4, 0, 0]}
              activeBar={{ fill: '#EF4444', opacity: 0.8 }}>
              {showPresupuesto ? barLabel(`presupuesto_${d.idx}`) : null}
            </Bar>,
          ])}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── Modo normal / comparación de período ─────────────────
  const sData = data as ChartRow[];
  if (tipo === 'area') return wrap(
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={sData} style={{ background: 'transparent' }}>
        <defs>
          <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colorVentas} stopOpacity={0.15} /><stop offset="95%" stopColor={colorVentas} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colorGastos} stopOpacity={0.12} /><stop offset="95%" stopColor={colorGastos} stopOpacity={0} />
          </linearGradient>
        </defs>
        {commonChildren}
        {showVentas && <Area type="monotone" dataKey="ventas" name="Ventas" stroke={colorVentas} strokeWidth={3} fill="url(#gV)" dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />}
        {showGastos && <Area type="monotone" dataKey="gastos" name="Gastos" stroke={colorGastos} strokeWidth={2.5} fill="url(#gG)" dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />}
        {hasComp && showVentas && <Area type="monotone" dataKey="ventasComp" name="Ventas (comp.)" stroke={colorVentas} strokeWidth={2} strokeDasharray="5 3" fill="none" dot={false} activeDot={{ r: 4 }} />}
        {hasComp && showGastos && <Area type="monotone" dataKey="gastosComp" name="Gastos (comp.)" stroke={colorGastos} strokeWidth={2} strokeDasharray="5 3" fill="none" dot={false} activeDot={{ r: 4 }} />}
      </AreaChart>
    </ResponsiveContainer>
  );

  if (tipo === 'linea') return wrap(
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={sData} style={{ background: 'transparent' }}>
        {commonChildren}
        {showVentas && <Line type="monotone" dataKey="ventas" name="Ventas" stroke={colorVentas} strokeWidth={2.5} dot={{ r: 3, fill: colorVentas, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />}
        {showGastos && <Line type="monotone" dataKey="gastos" name="Gastos" stroke={colorGastos} strokeWidth={2.5} dot={{ r: 3, fill: colorGastos, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />}
        {hasComp && showVentas && <Line type="monotone" dataKey="ventasComp" name="Ventas (comp.)" stroke={colorVentas} strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />}
        {hasComp && showGastos && <Line type="monotone" dataKey="gastosComp" name="Gastos (comp.)" stroke={colorGastos} strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />}
      </LineChart>
    </ResponsiveContainer>
  );

  return wrap(
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={sData} barCategoryGap="30%" barGap={2} margin={{ top: 22 }} style={{ background: 'transparent' }}>
        <defs>
          <pattern id="hatch_single" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={colorGastos} fillOpacity={0.15} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={colorGastos} strokeWidth="2.5" strokeOpacity={0.75} />
          </pattern>
          <pattern id="hatch_single_comp" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={colorGastos} fillOpacity={0.08} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={colorGastos} strokeWidth="2.5" strokeOpacity={0.4} />
          </pattern>
        </defs>
        {commonChildren}
        {showVentas && <Bar dataKey="ventas" name="Ventas" fill={colorVentas} radius={[4, 4, 0, 0]} activeBar={{ fill: colorVentas, opacity: 0.85, filter: 'brightness(1.25)' }}>{barLabel('ventas')}</Bar>}
        {showGastos && <Bar dataKey="gastos" name="Gastos" fill="url(#hatch_single)" radius={[4, 4, 0, 0]} activeBar={{ fill: colorGastos, opacity: 0.85 }}>{barLabel('gastos')}</Bar>}
        {hasComp && showVentas && <Bar dataKey="ventasComp" name="Ventas (comp.)" fill={colorVentas} opacity={0.5} radius={[4, 4, 0, 0]} activeBar={{ fill: colorVentas, opacity: 0.75 }}>{barLabel('ventasComp')}</Bar>}
        {hasComp && showGastos && <Bar dataKey="gastosComp" name="Gastos (comp.)" fill="url(#hatch_single_comp)" radius={[4, 4, 0, 0]} activeBar={{ fill: colorGastos, opacity: 0.75 }}>{barLabel('gastosComp')}</Bar>}
        {showPresupuesto && <Bar dataKey="presupuesto" name="Presupuesto" fill="#EF4444" opacity={0.55} radius={[4, 4, 0, 0]} activeBar={{ fill: '#EF4444', opacity: 0.8 }}>{barLabel('presupuesto')}</Bar>}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Helpers ─────────────────────────────────────────────
const MESES_LABELS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function keyToLabel(key: string) {
  const [anio, mes] = key.split('-');
  return `${MESES_LABELS[parseInt(mes, 10)]} ${anio}`;
}
type MesSlice = { ventas: number; efectivo: number; tarjeta: number; transf: number };
type DiaCaja = { fecha: string; local: string; ventas: number; efectivo: number; tarjeta: number; transf: number };
type DiaGasto = { fecha: string; mesKey?: string; sucursal: string; monto: number; proveedor?: string; subtipo?: string };

// Obtiene el lunes de la semana de una fecha ISO
// FIX: no usar toISOString() — da fecha UTC, en UTC-3 devuelve domingo en lugar de lunes
function getLunesSemana(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (isNaN(date.getTime())) return isoDate;
  const day = date.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(y, m - 1, d + diffToMonday, 0, 0, 0, 0);
  if (isNaN(monday.getTime())) return isoDate;
  // Construir YYYY-MM-DD desde partes LOCALES — nunca toISOString() (da UTC)
  const my = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const md = String(monday.getDate()).padStart(2, '0');
  return `${my}-${mm}-${md}`;
}

function formatDayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d)}/${parseInt(m)}`;
}
function formatWeekLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `Sem ${parseInt(d)}/${parseInt(m)}`;
}

// ─── Modal de detalle de proveedor ────────────────────────
function ProveedorModal({
  nombre,
  detalle,
  onClose,
}: {
  nombre: string;
  detalle: { total: number; meses: [string, number][]; locales: [string, number][] };
  onClose: () => void;
}) {
  const maxMes = Math.max(...detalle.meses.map(([, v]) => v), 1);
  const mesLabel = (k: string) => {
    const [y, m] = k.split('-');
    return `${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]} ${y}`;
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">Proveedor</p>
            <h2 className="text-[18px] font-bold" style={{ color: 'var(--text)' }}>{nombre}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-gray-400">Total período</p>
              <p className="text-[16px] font-bold text-blue-600">{fmtFull(detalle.total)}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 text-lg leading-none"
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-6">
          {/* Por mes */}
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-3">Evolución mensual</p>
            <div className="space-y-2.5">
              {detalle.meses.length === 0
                ? <p className="text-[11px] text-gray-400">Sin datos</p>
                : detalle.meses.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2.5">
                    <span className="text-[11px] text-gray-500 w-16 shrink-0">{mesLabel(k)}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-400 transition-all" style={{ width: `${(v / maxMes) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-blue-600 w-24 text-right">{fmtFull(v)}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Por local */}
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-3">Por local</p>
            <div className="space-y-2.5">
              {detalle.locales.length === 0
                ? <p className="text-[11px] text-gray-400">Sin datos</p>
                : detalle.locales.map(([loc, v]) => {
                  const pct = detalle.total > 0 ? (v / detalle.total) * 100 : 0;
                  return (
                    <div key={loc} className="flex items-center gap-2.5">
                      <span className="text-[11px] text-gray-500 w-16 shrink-0 truncate">{loc}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full bg-purple-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-purple-600 w-24 text-right">{fmtFull(v)}</span>
                    </div>
                  );
                })
              }
            </div>
            {detalle.locales.length > 0 && (
              <div className="mt-4 pt-3 border-t flex justify-between text-[11px]" style={{ borderColor: 'var(--border)' }}>
                <span className="text-gray-400">% mayor local</span>
                <span className="font-bold" style={{ color: 'var(--text)' }}>
                  {detalle.locales[0]?.[0]} · {detalle.total > 0 ? ((detalle.locales[0]?.[1] / detalle.total) * 100).toFixed(0) : 0}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-5">
          <p className="text-[10px] text-gray-400 text-center">Hacé click fuera o en ✕ para cerrar</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tipo presupuesto ─────────────────────────────────────
interface PresupuestoRow { local: string; mes: number; año: number; presupuesto: number; }

// ─── Página principal ─────────────────────────────────────
export default function VentasPage() {
  const [localSel, setLocalSel] = useState<string[]>([]);
  const [localOpen, setLocalOpen] = useState(false);
  const [metrica, setMetrica] = useState<Metrica>('ambos');
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('barras');
  const localRef = useRef<HTMLDivElement>(null);
  const dateRef  = useRef<HTMLDivElement>(null);
  // ── Estado raw desde Sheets ──────────────────────────────
  const [rawLocalMes, setRawLocalMes] = useState<Record<string, Record<string, MesSlice>>>({});
  const [rawGastosMes, setRawGastosMes] = useState<Record<string, number>>({});
  const [rawGastosMesSucursal, setRawGastosMesSucursal] = useState<Record<string, Record<string, number>>>({});
  const [rawDiasCaja, setRawDiasCaja] = useState<DiaCaja[]>([]);
  const [rawDiasGastos, setRawDiasGastos] = useState<DiaGasto[]>([]);
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [mesDesde, setMesDesde] = useState('');
  const [mesHasta, setMesHasta] = useState('');
  const [mesPill, setMesPill] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [modoFiltro, setModoFiltro] = useState<'mes' | 'dia'>('mes');
  // Comparación por período
  const [compOn, setCompOn] = useState(false);
  const [compMes, setCompMes] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(true);
  // Modal de proveedor
  const [proveedorModal, setProveedorModal] = useState<{ nombre: string; localFilter: string | null } | null>(null);
  // Presupuesto
  const [presupuestoOn, setPresupuestoOn] = useState(false);
  const [presupuestoData, setPresupuestoData] = useState<PresupuestoRow[]>([]);

  // Cierra dropdowns al hacer click fuera
  useEffect(() => {
    if (!localOpen) return;
    function handler(e: MouseEvent) {
      if (localRef.current && !localRef.current.contains(e.target as Node)) setLocalOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [localOpen]);

  useEffect(() => {
    if (!dateOpen) return;
    function handler(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dateOpen]);

  useEffect(() => {
    fetch('/api/presupuesto').then(r => r.json()).then(res => {
      if (res.ok) setPresupuestoData(res.data ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/cierre-caja').then(r => r.json()),
      fetch('/api/ventas').then(r => r.json()),
    ])
      .then(([caja, facturas]) => {
        if (caja.ok) {
          setRawLocalMes(caja.porLocalMes ?? {});
          setRawDiasCaja(caja.registrosDiarios ?? []);
        }
        const gastosPorMes: Record<string, number> = facturas.ok ? (facturas.gastosPorMes ?? {}) : {};
        if (facturas.ok) {
          setRawGastosMes(gastosPorMes);
          setRawDiasGastos(facturas.registrosDiariosGastos ?? []);
          setRawGastosMesSucursal(facturas.gastosPorMesSucursal ?? {});
        }

        // Unión de meses de ambas fuentes (YYYY-MM), ordenados
        const setCaja    = new Set<string>(caja.ok     ? (caja.mesesDisponibles ?? [])        : []);
        const setFactura = new Set<string>(facturas.ok ? Object.keys(gastosPorMes)             : []);
        const meses = [...new Set([...setCaja, ...setFactura])].sort();
        setMesesDisponibles(meses);
        if (meses.length) {
          // Default: mes actual si está disponible, si no el más reciente
          const hoy = new Date();
          const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
          const seleccionado = meses.includes(mesActual) ? mesActual : meses[meses.length - 1];
          setMesDesde(seleccionado);
          setMesHasta(seleccionado);
          setMesPill(seleccionado);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSheet(false));
  }, []);

  // ── Datos filtrados ──────────────────────────────────────
  const filteredData = useMemo(() => {
    // ── Helper: chart data para un rango de días ─────────────────────────────
    function buildDayChart(fDesde: string, fHasta: string, localFilter: string | null = null) {
      const diasVentas: Record<string, number> = {};
      const diasGastos: Record<string, number> = {};
      const porLocal: Record<string, { ventas: number; gastos: number }> = {};
      for (const r of rawDiasCaja) {
        if (!r.fecha) continue;
        if (localFilter !== null && r.local !== localFilter) continue;
        if (fDesde && r.fecha < fDesde) continue;
        if (fHasta && r.fecha > fHasta) continue;
        diasVentas[r.fecha] = (diasVentas[r.fecha] ?? 0) + r.ventas;
        if (!porLocal[r.local]) porLocal[r.local] = { ventas: 0, gastos: 0 };
        porLocal[r.local].ventas += r.ventas;
      }
      for (const r of rawDiasGastos) {
        if (!r.fecha) continue;
        if (localFilter !== null && r.sucursal !== localFilter) continue;
        if (fDesde && r.fecha < fDesde) continue;
        if (fHasta && r.fecha > fHasta) continue;
        diasGastos[r.fecha] = (diasGastos[r.fecha] ?? 0) + r.monto;
        if (r.sucursal) {
          if (!porLocal[r.sucursal]) porLocal[r.sucursal] = { ventas: 0, gastos: 0 };
          porLocal[r.sucursal].gastos += r.monto;
        }
      }
      const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
      const allDays = [...new Set([...Object.keys(diasVentas), ...Object.keys(diasGastos)])]
        .filter(d => { if (!ISO_RE.test(d)) return false; const [_y,_m,_day]=d.split('-').map(Number); return !isNaN(new Date(_y,_m-1,_day).getTime()); })
        .sort();
      let data: { fecha: string; ventas: number; gastos: number }[];
      if (allDays.length <= 31) {
        data = allDays.map(d => ({ fecha: formatDayLabel(d), ventas: diasVentas[d] ?? 0, gastos: diasGastos[d] ?? 0 }));
      } else {
        const porSemana: Record<string, { label: string; ventas: number; gastos: number }> = {};
        for (const d of allDays) {
          const lunes = getLunesSemana(d);
          if (!porSemana[lunes]) porSemana[lunes] = { label: formatWeekLabel(lunes), ventas: 0, gastos: 0 };
          porSemana[lunes].ventas += diasVentas[d] ?? 0;
          porSemana[lunes].gastos += diasGastos[d] ?? 0;
        }
        data = Object.entries(porSemana).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ fecha: v.label, ventas: v.ventas, gastos: v.gastos }));
      }
      return { data, porLocal };
    }

    // ── Helper: chart data para un rango de meses ────────────────────────────
    function buildMonthChart(mDesde: string, mHasta: string, localFilter: string | null = null) {
      const locals = localFilter !== null ? [localFilter] : Object.keys(rawLocalMes);
      const meses = mesesDisponibles.filter(m => (!mDesde || m >= mDesde) && (!mHasta || m <= mHasta));
      const byMes: Record<string, { ventas: number; gastos: number }> = {};
      for (const local of locals) {
        for (const mes of meses) {
          const d = rawLocalMes[local]?.[mes];
          if (!d) continue;
          if (!byMes[mes]) byMes[mes] = { ventas: 0, gastos: 0 };
          byMes[mes].ventas += d.ventas;
        }
      }
      if (localFilter === null) {
        for (const mes of meses) {
          if (!byMes[mes]) byMes[mes] = { ventas: 0, gastos: 0 };
          byMes[mes].gastos = rawGastosMes[mes] ?? 0;
        }
      } else {
        for (const mes of meses) {
          if (!byMes[mes]) byMes[mes] = { ventas: 0, gastos: 0 };
          byMes[mes].gastos = rawGastosMesSucursal[localFilter]?.[mes] ?? 0;
        }
      }
      return meses.map(m => ({ fecha: keyToLabel(m), ventas: byMes[m]?.ventas ?? 0, gastos: byMes[m]?.gastos ?? 0 }));
    }

    // ── Helper: fusiona período A y B alineados por índice ───────────────────
    function mergeWithComp(
      dataA: { fecha: string; ventas: number; gastos: number }[],
      dataB: { fecha: string; ventas: number; gastos: number }[],
    ): ChartRow[] {
      const maxLen = Math.max(dataA.length, dataB.length);
      return Array.from({ length: maxLen }, (_, i) => ({
        fecha:      dataA[i]?.fecha  ?? `+${i + 1}`,
        ventas:     dataA[i]?.ventas ?? 0,
        gastos:     dataA[i]?.gastos ?? 0,
        ventasComp: dataB[i]?.ventas,
        gastosComp: dataB[i]?.gastos,
        fechaComp:  dataB[i]?.fecha,
      }));
    }

    // ── Helper: top proveedores filtrado ─────────────────────────────────────
    function buildTopProveedores(fDesde: string, fHasta: string, mDesde: string, mHasta: string, modo: 'dia' | 'mes', localFilter: string | null = null) {
      const provMap: Record<string, number> = {};
      const provNombre: Record<string, string> = {};
      for (const r of rawDiasGastos) {
        if (!r.fecha || !r.proveedor) continue;
        if (localFilter !== null && r.sucursal !== localFilter) continue;
        if (modo === 'dia') {
          if (fDesde && r.fecha < fDesde) continue;
          if (fHasta && r.fecha > fHasta) continue;
        } else {
          // Usar mesKey (mes de pago) si disponible; si no, usar YYYY-MM de la fecha de emisión
          const mes = r.mesKey ?? r.fecha.slice(0, 7);
          if (mDesde && mes < mDesde) continue;
          if (mHasta && mes > mHasta) continue;
        }
        const key = r.proveedor.toLowerCase();
        if (!provNombre[key]) provNombre[key] = r.proveedor;
        provMap[key] = (provMap[key] ?? 0) + r.monto;
      }
      return Object.entries(provMap).sort(([, a], [, b]) => b - a).slice(0, 8).map(([key, monto]) => ({ nombre: provNombre[key], monto }));
    }

    // ── Helper: transacciones (cierres de caja) filtrado ─────────────────────
    function buildTransacciones(fDesde: string, fHasta: string, mDesde: string, mHasta: string, modo: 'dia' | 'mes', localFilter: string | null = null) {
      let count = 0;
      for (const r of rawDiasCaja) {
        if (!r.fecha) continue;
        if (localFilter !== null && r.local !== localFilter) continue;
        if (modo === 'dia') {
          if (fDesde && r.fecha < fDesde) continue;
          if (fHasta && r.fecha > fHasta) continue;
        } else {
          const mes = r.fecha.slice(0, 7);
          if (mDesde && mes < mDesde) continue;
          if (mHasta && mes > mHasta) continue;
        }
        count++;
      }
      return count;
    }

    // ── Helpers multi-local ───────────────────────────────────────────────────
    function buildMultiLocalMonthChart(mDesde: string, mHasta: string, locals: string[]): MultiChartRow[] {
      const meses = mesesDisponibles.filter(m => (!mDesde || m >= mDesde) && (!mHasta || m <= mHasta));
      return meses.map(m => {
        const row: MultiChartRow = { fecha: keyToLabel(m) };
        for (let i = 0; i < locals.length; i++) {
          row[`ventas_${i}`] = rawLocalMes[locals[i]]?.[m]?.ventas ?? 0;
          row[`gastos_${i}`] = rawGastosMesSucursal[locals[i]]?.[m] ?? 0;
        }
        return row;
      });
    }

    function buildMultiLocalDayChart(fDesde: string, fHasta: string, locals: string[]): MultiChartRow[] {
      const perLocalDays: Record<string, Record<string, { ventas: number; gastos: number }>> = {};
      const allDaysSet = new Set<string>();
      for (const r of rawDiasCaja) {
        if (!r.fecha || !locals.includes(r.local)) continue;
        if (fDesde && r.fecha < fDesde) continue;
        if (fHasta && r.fecha > fHasta) continue;
        allDaysSet.add(r.fecha);
        if (!perLocalDays[r.local]) perLocalDays[r.local] = {};
        if (!perLocalDays[r.local][r.fecha]) perLocalDays[r.local][r.fecha] = { ventas: 0, gastos: 0 };
        perLocalDays[r.local][r.fecha].ventas += r.ventas;
      }
      for (const r of rawDiasGastos) {
        if (!r.fecha || !r.sucursal || !locals.includes(r.sucursal)) continue;
        if (fDesde && r.fecha < fDesde) continue;
        if (fHasta && r.fecha > fHasta) continue;
        allDaysSet.add(r.fecha);
        if (!perLocalDays[r.sucursal]) perLocalDays[r.sucursal] = {};
        if (!perLocalDays[r.sucursal][r.fecha]) perLocalDays[r.sucursal][r.fecha] = { ventas: 0, gastos: 0 };
        perLocalDays[r.sucursal][r.fecha].gastos += r.monto;
      }
      const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
      const sortedDays = [...allDaysSet].filter(d => ISO_RE.test(d)).sort();
      if (sortedDays.length <= 31) {
        return sortedDays.map(d => {
          const row: MultiChartRow = { fecha: formatDayLabel(d) };
          for (let i = 0; i < locals.length; i++) {
            row[`ventas_${i}`] = perLocalDays[locals[i]]?.[d]?.ventas ?? 0;
            row[`gastos_${i}`] = perLocalDays[locals[i]]?.[d]?.gastos ?? 0;
          }
          return row;
        });
      }
      const porSemana: Record<string, Record<string, { ventas: number; gastos: number }>> = {};
      for (const d of sortedDays) {
        const lunes = getLunesSemana(d);
        for (const local of locals) {
          if (!porSemana[lunes]) porSemana[lunes] = {};
          if (!porSemana[lunes][local]) porSemana[lunes][local] = { ventas: 0, gastos: 0 };
          porSemana[lunes][local].ventas += perLocalDays[local]?.[d]?.ventas ?? 0;
          porSemana[lunes][local].gastos += perLocalDays[local]?.[d]?.gastos ?? 0;
        }
      }
      return Object.entries(porSemana).sort(([a], [b]) => a.localeCompare(b)).map(([lunes, byLocal]) => {
        const row: MultiChartRow = { fecha: formatWeekLabel(lunes) };
        for (let i = 0; i < locals.length; i++) {
          row[`ventas_${i}`] = byLocal[locals[i]]?.ventas ?? 0;
          row[`gastos_${i}`] = byLocal[locals[i]]?.gastos ?? 0;
        }
        return row;
      });
    }

    // ── Modo multi-local (2+ locales seleccionados) ───────────────────────────
    if (localSel.length >= 2) {
      const localDefs: LocalDef[] = localSel.map((local, i) => ({
        local, color: getSucursalColor(local, i), idx: i,
      }));
      let multiChartData: MultiChartRow[];
      if (modoFiltro === 'dia') {
        multiChartData = buildMultiLocalDayChart(fechaDesde, fechaHasta, localSel);
      } else {
        multiChartData = buildMultiLocalMonthChart(mesDesde, mesHasta, localSel);
      }
      const perLocalTotals = localSel.map((_, i) => ({
        ventas: multiChartData.reduce((s, r) => s + ((r[`ventas_${i}`] as number) ?? 0), 0),
        gastos: multiChartData.reduce((s, r) => s + ((r[`gastos_${i}`] as number) ?? 0), 0),
      }));
      const totalVentas = localSel.length === 2
        ? perLocalTotals[0].ventas
        : perLocalTotals.reduce((s, l) => s + l.ventas, 0);
      const totalGastos = localSel.length === 2
        ? perLocalTotals[0].gastos
        : perLocalTotals.reduce((s, l) => s + l.gastos, 0);
      const totalVentasComp = localSel.length === 2 ? perLocalTotals[1].ventas : 0;
      const totalGastosComp = localSel.length === 2 ? perLocalTotals[1].gastos : 0;
      const porLocalFiltrado: Record<string, { ventas: number; gastos: number }> = {};
      localSel.forEach((local, i) => { porLocalFiltrado[local] = perLocalTotals[i]; });
      const topProveedores = modoFiltro === 'dia'
        ? buildTopProveedores(fechaDesde, fechaHasta, '', '', 'dia', localSel[0])
        : buildTopProveedores('', '', mesDesde, mesHasta, 'mes', localSel[0]);
      const topProveedoresComp = localSel.length === 2
        ? (modoFiltro === 'dia'
          ? buildTopProveedores(fechaDesde, fechaHasta, '', '', 'dia', localSel[1])
          : buildTopProveedores('', '', mesDesde, mesHasta, 'mes', localSel[1]))
        : [];
      const totalTransacciones = modoFiltro === 'dia'
        ? buildTransacciones(fechaDesde, fechaHasta, '', '', 'dia', localSel[0])
        : buildTransacciones('', '', mesDesde, mesHasta, 'mes', localSel[0]);
      return {
        totalVentas, totalGastos, totalVentasComp, totalGastosComp,
        chartData: multiChartData as unknown as ChartRow[],
        porLocalFiltrado, hasComp: localSel.length === 2, localDefs,
        totalTransacciones, topProveedores, topProveedoresComp,
      };
    }

    // ── Determinar modo de comparación ───────────────────────────────────────
    const localFilter = localSel.length === 1 ? localSel[0] : null;
    const isLocalComp = false; // multi-local path handles 2+ now
    const isPeriodComp = compOn && !!compMes;
    // Cuando hay comparación A vs B, dataA debe usar solo el primer local (no null)
    const dataAFilter = localFilter;

    // ── Modo día/semana ───────────────────────────────────────────────────────
    if (modoFiltro === 'dia') {
      const { data: dataA, porLocal } = buildDayChart(fechaDesde, fechaHasta, dataAFilter);
      let chartData: ChartRow[] = dataA;
      let totalVentasComp = 0, totalGastosComp = 0;
      if (isLocalComp) {
        const { data: dataB } = buildDayChart(fechaDesde, fechaHasta, localSel[1]);
        totalVentasComp = dataB.reduce((s, r) => s + r.ventas, 0);
        totalGastosComp = dataB.reduce((s, r) => s + r.gastos, 0);
        chartData = mergeWithComp(dataA, dataB);
      }
      const totalVentas = dataA.reduce((s, r) => s + r.ventas, 0);
      const totalGastos = dataA.reduce((s, r) => s + r.gastos, 0);
      const totalTransacciones = buildTransacciones(fechaDesde, fechaHasta, '', '', 'dia', dataAFilter);
      const topProveedores = buildTopProveedores(fechaDesde, fechaHasta, '', '', 'dia', dataAFilter);
      const topProveedoresComp = isLocalComp ? buildTopProveedores(fechaDesde, fechaHasta, '', '', 'dia', localSel[1]) : [];
      return { totalVentas, totalGastos, totalVentasComp, totalGastosComp, chartData, porLocalFiltrado: porLocal, hasComp: isLocalComp, totalTransacciones, topProveedores, topProveedoresComp };
    }

    // ── Modo mes ─────────────────────────────────────────────────────────────
    const dataA = buildMonthChart(mesDesde, mesHasta, dataAFilter);
    let chartData: ChartRow[] = dataA;
    let totalVentasComp = 0, totalGastosComp = 0;
    if (isLocalComp) {
      const dataB = buildMonthChart(mesDesde, mesHasta, localSel[1]);
      totalVentasComp = dataB.reduce((s, r) => s + r.ventas, 0);
      totalGastosComp = dataB.reduce((s, r) => s + r.gastos, 0);
      chartData = mergeWithComp(dataA, dataB);
    } else if (isPeriodComp) {
      const dataB = buildMonthChart(compMes, compMes, localFilter);
      totalVentasComp = dataB.reduce((s, r) => s + r.ventas, 0);
      totalGastosComp = dataB.reduce((s, r) => s + r.gastos, 0);
      chartData = mergeWithComp(dataA, dataB);
    }
    const totalVentas = dataA.reduce((s, r) => s + r.ventas, 0);
    const totalGastos = dataA.reduce((s, r) => s + r.gastos, 0);

    const mesesFiltrados = mesesDisponibles.filter(m => (!mesDesde || m >= mesDesde) && (!mesHasta || m <= mesHasta));
    const porLocalFiltrado: Record<string, { ventas: number; gastos: number }> = {};
    const localsToShow = localSel.length > 0 ? localSel : Object.keys(rawLocalMes);
    for (const local of localsToShow) {
      for (const mes of mesesFiltrados) {
        const d = rawLocalMes[local]?.[mes];
        if (!d) continue;
        if (!porLocalFiltrado[local]) porLocalFiltrado[local] = { ventas: 0, gastos: 0 };
        porLocalFiltrado[local].ventas += d.ventas;
      }
    }
    for (const local of Object.keys(rawGastosMesSucursal)) {
      if (localSel.length > 0 && !localSel.includes(local)) continue;
      for (const mes of mesesFiltrados) {
        const g = rawGastosMesSucursal[local]?.[mes] ?? 0;
        if (!g) continue;
        if (!porLocalFiltrado[local]) porLocalFiltrado[local] = { ventas: 0, gastos: 0 };
        porLocalFiltrado[local].gastos += g;
      }
    }

    const totalTransacciones = buildTransacciones('', '', mesDesde, mesHasta, 'mes', dataAFilter);
    const topProveedores = buildTopProveedores('', '', mesDesde, mesHasta, 'mes', dataAFilter);
    const topProveedoresComp = isLocalComp ? buildTopProveedores('', '', mesDesde, mesHasta, 'mes', localSel[1]) : [];
    const hasComp = isLocalComp || (isPeriodComp && totalVentasComp > 0);
    return { totalVentas, totalGastos, totalVentasComp, totalGastosComp, chartData, porLocalFiltrado, hasComp, totalTransacciones, topProveedores, topProveedoresComp };
  }, [rawLocalMes, rawGastosMes, rawGastosMesSucursal, rawDiasCaja, rawDiasGastos, localSel,
      mesDesde, mesHasta, mesesDisponibles, fechaDesde, fechaHasta, modoFiltro,
      compOn, compMes]);

  // ── Detalle de proveedor seleccionado ──────────────────────
  const proveedorDetalle = useMemo(() => {
    if (!proveedorModal) return null;
    const { nombre, localFilter } = proveedorModal;
    const porMes: Record<string, number> = {};
    const porLocal: Record<string, number> = {};
    let total = 0;
    for (const r of rawDiasGastos) {
      if ((r.proveedor ?? '').toLowerCase() !== nombre.toLowerCase()) continue;
      if (localFilter && r.sucursal !== localFilter) continue;
      const mes = r.fecha?.slice(0, 7) ?? '';
      if (modoFiltro === 'mes') {
        if (mesDesde && mes < mesDesde) continue;
        if (mesHasta && mes > mesHasta) continue;
      } else {
        if (fechaDesde && r.fecha < fechaDesde) continue;
        if (fechaHasta && r.fecha > fechaHasta) continue;
      }
      porMes[mes] = (porMes[mes] ?? 0) + r.monto;
      const suc = r.sucursal || 'Sin local';
      porLocal[suc] = (porLocal[suc] ?? 0) + r.monto;
      total += r.monto;
    }
    const meses = Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b));
    const locales = Object.entries(porLocal).sort(([, a], [, b]) => b - a);
    return { total, meses, locales };
  }, [proveedorModal, rawDiasGastos, mesDesde, mesHasta, fechaDesde, fechaHasta, modoFiltro]);

  const ventasReal = filteredData.totalVentas;
  const gastosReal = filteredData.totalGastos;
  const ventasComp = filteredData.totalVentasComp ?? 0;
  const gastosComp = filteredData.totalGastosComp ?? 0;
  const hasComp    = filteredData.hasComp ?? false;
  const margen = ventasReal > 0 ? (((ventasReal - gastosReal) / ventasReal) * 100).toFixed(1) : '0.0';
  const margenComp = ventasComp > 0 ? (((ventasComp - gastosComp) / ventasComp) * 100).toFixed(1) : null;
  const chartData = filteredData.chartData.length > 0 ? filteredData.chartData : rawData['30D'];
  const localesDisponibles = Object.keys(rawLocalMes);
  const isLocalComp = localSel.length === 2;
  const isMultiLocal = localSel.length >= 2;
  const localDefs = (filteredData as any).localDefs as LocalDef[] | undefined;

  // ── Reverse map: label → YYYY-MM (para cruzar chartData con presupuesto) ──
  const labelToKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of mesesDisponibles) map[keyToLabel(m)] = m;
    return map;
  }, [mesesDisponibles]);

  // ── Chart data enriquecido con presupuesto ────────────────
  const chartDataWithPres = useMemo(() => {
    const base = filteredData.chartData.length > 0 ? filteredData.chartData : rawData['30D'];
    if (!presupuestoOn || !presupuestoData.length) return base;
    const getP = (mesKey: string, local: string | null): number => {
      if (!mesKey) return 0;
      const [añoStr, mesStr] = mesKey.split('-');
      const año = parseInt(añoStr), mes = parseInt(mesStr);
      const byMonth = presupuestoData.filter(r => r.año === año && r.mes === mes);
      if (!byMonth.length) return 0;
      if (local) {
        // Match flexible: exact, substring o partial (maneja "La Reina" vs "LA OCA LA REINA")
        const ll = local.toLowerCase();
        const match = byMonth.find(r => {
          const rl = r.local.toLowerCase();
          return rl === ll || rl.includes(ll) || ll.includes(rl);
        });
        return match?.presupuesto ?? 0;
      }
      // Sin filtro de local: suma todos los locales del mes
      return byMonth.reduce((s, r) => s + r.presupuesto, 0);
    };
    if (isMultiLocal && localDefs) {
      return (base as MultiChartRow[]).map(row => {
        const mesKey = labelToKey[row.fecha as string] ?? '';
        const extra: Record<string, number> = {};
        for (const def of localDefs) extra[`presupuesto_${def.idx}`] = getP(mesKey, def.local);
        return { ...row, ...extra };
      });
    }
    return (base as ChartRow[]).map(row => ({
      ...row,
      presupuesto: getP(labelToKey[row.fecha] ?? '', localSel.length === 1 ? localSel[0] : null),
    }));
  }, [filteredData.chartData, presupuestoOn, presupuestoData, labelToKey, localSel, isMultiLocal, localDefs, localesDisponibles]);

  // ── Proyección de ventas ───────────────────────────────────
  const proyeccionData = useMemo(() => {
    if (!mesDesde) return [];
    const mes = mesDesde; // YYYY-MM (usa el mes inicial del filtro)
    const [year, month] = mes.split('-').map(Number);
    const totalDias = new Date(year, month, 0).getDate();
    const lista = localSel.length > 0 ? localSel : localesDisponibles;

    return lista.map(local => {
      const ventasActual = rawLocalMes[local]?.[mes]?.ventas ?? 0;
      // Días únicos con registros de venta para este local y mes
      const diasConRegistros = new Set(
        rawDiasCaja
          .filter(r => r.local === local && r.fecha?.startsWith(mes) && r.ventas > 0)
          .map(r => r.fecha)
      ).size;
      const proyeccion = diasConRegistros > 0
        ? Math.round((ventasActual / diasConRegistros) * totalDias)
        : 0;
      const restante = Math.max(0, proyeccion - ventasActual);
      return {
        local,
        real: ventasActual,
        restante,
        proyeccion,
        diasConRegistros,
        totalDias,
        color: getSucursalColor(local),
      };
    }).filter(d => d.proyeccion > 0 || d.real > 0);
  }, [rawDiasCaja, rawLocalMes, mesDesde, localSel, localesDisponibles]);

  const handleExportChart = () => {
    exportToCSV(chartData.map(d => ({ Fecha: d.fecha, Ventas: d.ventas, Gastos: d.gastos })), 'ventas_gastos');
    toast('Datos del gráfico exportados');
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between flex-wrap px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-30 transition-colors gap-2"
        style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-[16px] sm:text-[18px] font-bold shrink-0" style={{ color: 'var(--text)' }}>Ventas & Gastos</h1>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">

          {/* Período mes */}
          <PeriodSelect
            label="Período"
            value={mesPill}
            options={mesesDisponibles.map(m => ({ label: keyToLabel(m), value: m }))}
            onChange={v => {
              setMesPill(v);
              if (v) {
                setMesDesde(v); setMesHasta(v);
              } else if (mesesDisponibles.length) {
                setMesDesde(mesesDisponibles[0]);
                setMesHasta(mesesDisponibles[mesesDisponibles.length - 1]);
              }
              setModoFiltro('mes');
              setFechaDesde(''); setFechaHasta('');
            }}
            allLabel="Todos los meses"
          />

          {/* Rango días */}
          <div className="relative" ref={dateRef}>
            <button
              onClick={() => setDateOpen(!dateOpen)}
              className={clsx(
                'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all',
                modoFiltro === 'dia' || fechaDesde || fechaHasta
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
              )}
            >
              <Calendar className="w-3.5 h-3.5 opacity-80" />
              <span className="font-semibold text-[11px]">
                {modoFiltro === 'dia' && (fechaDesde || fechaHasta)
                  ? `${fechaDesde || '…'} – ${fechaHasta || '…'}`
                  : 'Rango días'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {dateOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3 min-w-[240px]">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Rango de días</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Desde</p>
                    <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setModoFiltro('dia'); setMesPill(''); }}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Hasta</p>
                    <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setModoFiltro('dia'); setMesPill(''); }}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">≤ 31 días → diario · &gt; 31 días → semanal</p>
                {(fechaDesde || fechaHasta) && (
                  <button onClick={() => { setFechaDesde(''); setFechaHasta(''); setModoFiltro('mes'); }}
                    className="mt-1.5 text-[10px] text-red-400 hover:text-red-600 font-semibold">
                    Limpiar fechas
                  </button>
                )}
                <button onClick={() => setDateOpen(false)}
                  className="mt-3 w-full text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg py-1.5 transition-colors">
                  Aplicar
                </button>
              </div>
            )}
          </div>

          {/* Locales multi-select (hasta 2 para comparar) */}
          <div className="relative" ref={localRef}>
            <button
              onClick={() => setLocalOpen(!localOpen)}
              className={clsx(
                'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all',
                localSel.length >= 2
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : localSel.length === 1
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600',
              )}
            >
              <MapPin className="w-3.5 h-3.5 opacity-80" />
              <span className="font-semibold text-[11px]">
                {localSel.length === 0
                  ? 'Todos los locales'
                  : localSel.length === 1
                    ? localSel[0]
                    : localSel.length === 2
                      ? `${localSel[0]} vs ${localSel[1]}`
                      : `${localSel.length} locales`}
              </span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {localOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[220px] rounded-2xl shadow-xl overflow-hidden"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>
                    Seleccionar locales
                    {localSel.length >= 2 && <span className="ml-1.5 text-purple-500">· Comparando</span>}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>Seleccioná los locales a comparar</p>
                </div>
                {localSel.length > 0 && (
                  <button onClick={() => setLocalSel([])}
                    className="w-full text-left px-4 py-2 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    Limpiar selección
                  </button>
                )}
                {localesDisponibles.map(local => {
                  const selIdx = localSel.indexOf(local);
                  const selected = selIdx !== -1;
                  const color = selected ? LOCAL_COLORS[selIdx % LOCAL_COLORS.length] : undefined;
                  return (
                    <button key={local}
                      onClick={() => setLocalSel(prev => prev.includes(local) ? prev.filter(l => l !== local) : [...prev, local])}
                      className="w-full text-left px-4 py-2.5 text-[12px] flex items-center gap-3 transition-colors hover:bg-gray-50/10"
                    >
                      <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-black border"
                        style={selected
                          ? { background: color, borderColor: color, color: '#fff' }
                          : { borderColor: 'var(--border-2)' }}>
                        {selected ? String.fromCharCode(65 + selIdx) : ''}
                      </span>
                      <span className="font-medium" style={{ color: selected ? color : 'var(--text)' }}>{local}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comparar por período (solo cuando no hay comparación de locales) */}
          {!isLocalComp && (
            <>
              <button
                onClick={() => {
                  const next = !compOn;
                  setCompOn(next);
                  if (next && !compMes && mesesDisponibles.length >= 2) {
                    setCompMes(mesesDisponibles[mesesDisponibles.length - 2]);
                  }
                }}
                className={clsx(
                  'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all',
                  compOn
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-600',
                )}
              >
                <GitCompare className="w-3.5 h-3.5 opacity-80" />
                <span className="font-semibold text-[11px]">Comparar</span>
              </button>
              {compOn && (
                <select value={compMes} onChange={e => setCompMes(e.target.value)}
                  className="border border-purple-300 bg-purple-50 rounded-xl px-3 py-2 text-[11px] font-semibold text-purple-700 outline-none">
                  <option value="">— mes —</option>
                  {mesesDisponibles.map(m => <option key={m} value={m}>{keyToLabel(m)}</option>)}
                </select>
              )}
            </>
          )}

          {/* Presupuesto toggle */}
          <button
            onClick={() => setPresupuestoOn(v => !v)}
            className={clsx(
              'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all',
              presupuestoOn
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600',
            )}
          >
            <Wallet className="w-3.5 h-3.5 opacity-80" />
            <span className="font-semibold text-[11px]">Presupuesto</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 w-44">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input type="text" placeholder="Buscar..." className="bg-transparent text-[12px] text-gray-600 outline-none w-full placeholder-gray-400" />
          </div>
          <button className="hidden sm:block relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 pb-8">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: 'Ventas Total', value: loadingSheet ? '...' : fmtFull(ventasReal),
              comp: hasComp && ventasComp > 0 ? fmtFull(ventasComp) : null,
              deltaPct: hasComp && ventasComp > 0 ? (((ventasReal - ventasComp) / ventasComp) * 100).toFixed(1) : null,
              icon: <DollarSign className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-50',
            },
            {
              label: 'Gasto Total', value: loadingSheet ? '...' : fmtFull(gastosReal),
              comp: hasComp && gastosComp > 0 ? fmtFull(gastosComp) : null,
              deltaPct: hasComp && gastosComp > 0 ? (((gastosReal - gastosComp) / gastosComp) * 100).toFixed(1) : null,
              icon: <Receipt className="w-4 h-4 text-red-500" />, bg: 'bg-red-50',
            },
            {
              label: 'Margen Neto', value: `${margen}%`,
              comp: margenComp ? `${margenComp}%` : null,
              deltaPct: margenComp ? (parseFloat(margen) - parseFloat(margenComp)).toFixed(1) : null,
              icon: <BarChart2 className="w-4 h-4 text-green-600" />, bg: 'bg-green-50',
            },
            {
              label: 'Índice 60', value: loadingSheet ? '...' : ventasReal > 0 ? `${((gastosReal / ventasReal) * 100).toFixed(1)}%` : '—', comp: null, deltaPct: null,
              icon: <Activity className="w-4 h-4 text-purple-600" />, bg: 'bg-purple-50',
            },
          ].map(k => {
            const delta = k.deltaPct !== null ? parseFloat(k.deltaPct) : null;
            const pos = delta === null ? true : delta >= 0;
            return (
            <div key={k.label} className="rounded-2xl p-3 sm:p-5 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-gray-400 uppercase">{k.label}</p>
                <div className={clsx('w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center', k.bg)}>{k.icon}</div>
              </div>
              <div className="flex items-end gap-1.5 mb-1">
                <p className="text-[17px] sm:text-[22px] font-black text-gray-900 leading-none truncate">{k.value}</p>
                {delta !== null && (
                  <span className={clsx('text-[11px] font-bold pb-0.5', pos ? 'text-green-600' : 'text-red-500')}>
                    {pos ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                    {pos ? '+' : ''}{k.deltaPct}%
                  </span>
                )}
              </div>
              {k.comp
                ? <p className="text-[10px] text-blue-500 font-medium">comp: {k.comp}</p>
                : <p className="text-[10px] text-gray-400">{hasComp ? 'sin datos comparativos' : 'Período seleccionado'}</p>
              }
            </div>
            );
          })}
        </div>

        {/* ── Panel de Comparación ── */}
        {hasComp && (
          <ComparisonPanel
            labelA={
              isLocalComp
                ? localSel[0]
                : modoFiltro === 'dia' && (fechaDesde || fechaHasta)
                  ? `${fechaDesde || '…'} → ${fechaHasta || '…'}`
                  : mesDesde
                    ? (mesDesde === mesHasta ? keyToLabel(mesDesde) : `${keyToLabel(mesDesde)} – ${keyToLabel(mesHasta)}`)
                    : 'Período A'
            }
            labelB={
              isLocalComp
                ? localSel[1]
                : compMes
                  ? keyToLabel(compMes)
                  : 'Período B'
            }
            colorA="#3B82F6"
            colorB="#8B5CF6"
            loading={loadingSheet}
            metrics={[
              {
                label: 'Ventas',
                valueA: ventasReal,
                valueB: ventasComp,
                format: fmtFull,
                higherIsBetter: true,
              },
              {
                label: 'Gastos',
                valueA: gastosReal,
                valueB: gastosComp,
                format: fmtFull,
                higherIsBetter: false,
              },
              {
                label: 'Margen %',
                valueA: parseFloat(margen),
                valueB: margenComp !== null ? parseFloat(margenComp) : null,
                format: v => v.toFixed(1) + '%',
                higherIsBetter: true,
              },
            ]}
          />
        )}

        {/* ── Gráfico interactivo ── */}
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {/* Controles */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-gray-900 mr-2">Tendencia</h3>

              {/* Métrica */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                {(['ventas', 'gastos', 'ambos'] as Metrica[]).map(m => (
                  <button key={m} onClick={() => setMetrica(m)}
                    className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all capitalize',
                      metrica === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    {m === 'ambos' ? 'Comparar' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>

              {/* Rango activo */}
              {mesDesde && mesHasta && (
                <span className="text-[11px] text-gray-500 bg-gray-100 rounded-xl px-3 py-1.5 font-medium">
                  {keyToLabel(mesDesde)}{mesDesde !== mesHasta ? ` – ${keyToLabel(mesHasta)}` : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Tipo de gráfico */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                <button onClick={() => setTipoGrafico('area')}
                  className={clsx('p-1.5 rounded-lg transition-all', tipoGrafico === 'area' ? 'bg-white shadow-sm' : 'hover:bg-white/60')}
                  title="Área">
                  <Activity className={clsx('w-3.5 h-3.5', tipoGrafico === 'area' ? 'text-blue-600' : 'text-gray-400')} />
                </button>
                <button onClick={() => setTipoGrafico('linea')}
                  className={clsx('p-1.5 rounded-lg transition-all', tipoGrafico === 'linea' ? 'bg-white shadow-sm' : 'hover:bg-white/60')}
                  title="Línea">
                  <TrendingUp className={clsx('w-3.5 h-3.5', tipoGrafico === 'linea' ? 'text-blue-600' : 'text-gray-400')} />
                </button>
                <button onClick={() => setTipoGrafico('barras')}
                  className={clsx('p-1.5 rounded-lg transition-all', tipoGrafico === 'barras' ? 'bg-white shadow-sm' : 'hover:bg-white/60')}
                  title="Barras">
                  <LayoutGrid className={clsx('w-3.5 h-3.5', tipoGrafico === 'barras' ? 'text-blue-600' : 'text-gray-400')} />
                </button>
              </div>

              <button onClick={handleExportChart} className="flex items-center gap-1.5 text-[12px] text-blue-600 font-semibold hover:text-blue-800 transition-colors border border-blue-200 rounded-lg px-3 py-1.5">
                <Download className="w-3.5 h-3.5" />
                Exportar
              </button>
            </div>
          </div>

          {/* Leyenda rápida */}
          <div className="flex items-center gap-4 mb-3">
            {(metrica === 'ventas' || metrica === 'ambos') && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />Ventas
              </div>
            )}
            {(metrica === 'gastos' || metrica === 'ambos') && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-3 h-0.5 bg-red-500 inline-block rounded" />Gastos
              </div>
            )}
            <span className="text-[10px] text-gray-300">|</span>
            {modoFiltro === 'dia'
              ? <span className="text-[10px] text-blue-500 font-medium">{fechaDesde || '…'} → {fechaHasta || '…'} · {chartData.length} punto{chartData.length !== 1 ? 's' : ''}</span>
              : <span className="text-[10px] text-gray-400">{chartData.length} {chartData.length === 1 ? 'mes' : 'meses'}</span>
            }
          </div>

          <InteractiveChart data={chartDataWithPres} metrica={metrica} tipo={tipoGrafico} hasComp={hasComp && !isMultiLocal} localDefs={isMultiLocal ? localDefs : undefined} localName={localSel.length === 1 ? localSel[0] : undefined} showPresupuesto={presupuestoOn} />
        </div>

        {/* ── Bottom Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">

          {/* Proyección de Ventas */}
          <div className="sm:col-span-1 rounded-2xl p-5 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Proyección de Ventas</h3>
            </div>
            <p className="text-[10px] mb-4" style={{ color: 'var(--text-3)' }}>
              (Ventas reales / días con registro) × días del mes
            </p>
            {proyeccionData.length === 0 ? (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Sin datos para proyectar</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={proyeccionData} layout="vertical" barCategoryGap="20%" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="local" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} width={58} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="rounded-xl shadow-lg px-3 py-2.5 text-[11px]"
                            style={{ background: 'var(--card)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                            <p className="font-bold mb-1.5">{d.local}</p>
                            <p style={{ color: 'var(--text-3)' }}>Real: <span className="font-semibold" style={{ color: d.color }}>{fmtFull(d.real)}</span></p>
                            <p style={{ color: 'var(--text-3)' }}>Proyección: <span className="font-semibold" style={{ color: 'var(--text)' }}>{fmtFull(d.proyeccion)}</span></p>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>{d.diasConRegistros} días con registros / {d.totalDias} días del mes</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="real" stackId="p" name="Real" radius={[0, 0, 0, 0]}>
                      {proyeccionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                    <Bar dataKey="restante" stackId="p" name="Proyección restante" radius={[0, 4, 4, 0]}>
                      {proyeccionData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.2} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-2">
                  {proyeccionData.map(d => (
                    <div key={d.local} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        <span style={{ color: 'var(--text-2)' }}>{d.local}</span>
                      </div>
                      <span className="font-bold" style={{ color: 'var(--text)' }}>{fmtFull(d.proyeccion)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Top Proveedores (datos reales del Sheet) */}
          <div className="sm:col-span-2 rounded-2xl p-5 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Top Proveedores</h3>
              <button
                onClick={() => {
                  exportToCSV(filteredData.topProveedores.map((p, i) => ({
                    '#': i + 1, Proveedor: p.nombre, 'Monto CLP': p.monto,
                    '% del Total': gastosReal > 0 ? ((p.monto / gastosReal) * 100).toFixed(1) + '%' : '—',
                  })), 'top_proveedores');
                  toast('Top proveedores exportado');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors">
                <Download className="w-3 h-3" />CSV
              </button>
            </div>

            {filteredData.hasComp && filteredData.topProveedoresComp.length > 0 ? (
              /* ── Modo comparativo: 2 columnas ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: localSel[0], list: filteredData.topProveedores, gastos: gastosReal, color: 'text-blue-600', bar: 'bg-blue-400' },
                  { label: localSel[1], list: filteredData.topProveedoresComp, gastos: gastosComp, color: 'text-purple-600', bar: 'bg-purple-400' },
                ].map(({ label, list, gastos, color, bar }) => (
                  <div key={label}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${color}`}>{label}</p>
                    <div className="grid grid-cols-[1.5rem_1fr_5.5rem_3.5rem] gap-1.5 pb-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                      {['#', 'Proveedor', 'Monto', '%'].map(c => (
                        <p key={c} className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">{c}</p>
                      ))}
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {loadingSheet ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-[1.5rem_1fr_5.5rem_3.5rem] gap-1.5 py-2 animate-pulse">
                          <div className="h-2.5 bg-gray-200 rounded w-3" />
                          <div className="h-2.5 bg-gray-200 rounded" />
                          <div className="h-2.5 bg-gray-200 rounded" />
                          <div className="h-2.5 bg-gray-200 rounded w-6" />
                        </div>
                      )) : list.length === 0 ? (
                        <p className="text-[11px] text-gray-400 py-3 text-center">Sin datos</p>
                      ) : list.map((p, i) => {
                        const pct = gastos > 0 ? ((p.monto / gastos) * 100).toFixed(1) : '0';
                        return (
                          <div
                            key={p.nombre}
                            onClick={() => setProveedorModal({ nombre: p.nombre, localFilter: label })}
                            className="grid grid-cols-[1.5rem_1fr_5.5rem_3.5rem] gap-1.5 py-2 items-center rounded cursor-pointer hover:bg-gray-50/40 transition-colors"
                          >
                            <span className="text-[10px] font-bold text-gray-400">#{i + 1}</span>
                            <p className="text-[10px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.nombre || '(sin nombre)'}</p>
                            <p className={`text-[10px] font-bold ${color}`}>{fmtFull(p.monto)}</p>
                            <div className="flex items-center gap-1">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                              </div>
                              <span className="text-[9px] text-gray-400 w-5 text-right">{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Modo normal: 1 columna ── */
              <>
                <div className="grid grid-cols-[2rem_1fr_6rem_4rem] gap-2 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  {['#', 'Proveedor', 'Monto', '%'].map(c => (
                    <p key={c} className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">{c}</p>
                  ))}
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {loadingSheet ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-[2rem_1fr_6rem_4rem] gap-2 py-2.5 animate-pulse">
                        <div className="h-3 bg-gray-200 rounded w-4" />
                        <div className="h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-gray-200 rounded w-8" />
                      </div>
                    ))
                  ) : filteredData.topProveedores.length === 0 ? (
                    <p className="text-[11px] text-gray-400 py-4 text-center">Sin datos para el período seleccionado</p>
                  ) : (
                    filteredData.topProveedores.map((p, i) => {
                      const pct = gastosReal > 0 ? ((p.monto / gastosReal) * 100).toFixed(1) : '0';
                      return (
                        <div
                          key={p.nombre}
                          onClick={() => setProveedorModal({ nombre: p.nombre, localFilter: null })}
                          className="grid grid-cols-[2rem_1fr_6rem_4rem] gap-2 py-2.5 items-center rounded-lg cursor-pointer hover:bg-gray-50/40 transition-colors"
                        >
                          <span className="text-[11px] font-bold text-gray-400">#{i + 1}</span>
                          <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.nombre || '(sin nombre)'}</p>
                          <p className="text-[11px] font-bold text-red-500">{fmtFull(p.monto)}</p>
                          <div className="flex items-center gap-1">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                            </div>
                            <span className="text-[9px] text-gray-400 w-6 text-right">{pct}%</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Modal proveedor */}
      {proveedorModal && proveedorDetalle && (
        <ProveedorModal
          nombre={proveedorModal.nombre}
          detalle={proveedorDetalle}
          onClose={() => setProveedorModal(null)}
        />
      )}
    </div>
  );
}
