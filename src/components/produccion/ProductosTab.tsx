'use client';

/**
 * Solapa "Productos" de Producción.
 *
 * Existe para responder una sola pregunta sin bajar el Excel de ConectOca:
 * ¿cuánto se vendió de tal producto en tal período? Por eso el buscador es el
 * elemento principal y no un adorno del header.
 *
 * Todo lo que muestra sale del mismo fetch de /api/produccion-data que alimenta
 * la solapa Resumen — cambiar de solapa no dispara una consulta nueva.
 */

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Search, Package, X, Download, ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface ProductoAgregado {
  nombre: string;
  categoria: string;
  unidades: number;
  ingresos: number;
  /**
   * Desglose PARCIAL por sucursal — solo cubre los pedidos de ConectOca que
   * traen un cliente identificable como local (ver localDePedidoConectOca
   * en produccion-data/route.ts). La mayoría de los pedidos no tiene ese
   * dato, así que esto NUNCA es el total real vendido en cada local — ver
   * sinIdentificar, que casi siempre es la parte más grande.
   */
  porLocalIdentificado?: Record<string, { unidades: number; ingresos: number }>;
  sinIdentificar?: { unidades: number; ingresos: number };
}
/** { "Marraqueta": { "2026-08-14": { unidades, ingresos } } } — sparse */
export type ProductosPorDia = Record<string, Record<string, { unidades: number; ingresos: number }>>;

const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const fmtUnid  = (n: number) =>
  n.toLocaleString('es-CL', { maximumFractionDigits: 2 });

/** "marraqueta" encuentra "Marraqueta"; "empanada pino" encuentra "Empanada Pino" */
const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function descargarCSV(nombreArchivo: string, filas: (string | number)[][]) {
  const cuerpo = filas
    .map(f => f.map(c => (typeof c === 'string' && /[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';'))
    .join('\n');
  // BOM para que Excel en español abra los acentos bien
  const blob = new Blob(['﻿' + cuerpo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProductosTab({
  productos,
  productosPorDia,
  totalUnidades,
  totalVentas,
  totalPedidos,
  periodoLabel,
  agruparPorMes,
  cargando,
}: {
  productos: ProductoAgregado[];
  productosPorDia: ProductosPorDia;
  totalUnidades: number;
  totalVentas: number;
  totalPedidos: number;
  periodoLabel: string;
  /** true en modo "Por mes": la serie del producto se agrupa por mes en vez de por día */
  agruparPorMes: boolean;
  cargando: boolean;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [areaSel, setAreaSel] = useState('Todas');
  const [orden, setOrden] = useState<'unidades' | 'ingresos'>('unidades');
  const [direccion, setDireccion] = useState<'desc' | 'asc'>('desc');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  /**
   * Click en una columna ya activa invierte el orden (para pasar de "el
   * mejor" a "el menos rentable" sin scrollear 200 filas); click en la otra
   * columna cambia de criterio y arranca de nuevo por el mejor.
   */
  function cambiarOrden(campo: 'unidades' | 'ingresos') {
    if (orden === campo) setDireccion(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setOrden(campo); setDireccion('desc'); }
  }

  const areas = useMemo(
    () => ['Todas', ...[...new Set(productos.map(p => p.categoria))].sort()],
    [productos],
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    const signo = direccion === 'desc' ? 1 : -1;
    return productos
      .filter(p => (areaSel === 'Todas' || p.categoria === areaSel))
      .filter(p => !q || normalizar(p.nombre).includes(q))
      .sort((a, b) => signo * (b[orden] - a[orden]));
  }, [productos, busqueda, areaSel, orden, direccion]);

  const producto = useMemo(
    () => (seleccionado ? productos.find(p => p.nombre === seleccionado) ?? null : null),
    [seleccionado, productos],
  );

  /** Serie del producto elegido, agrupada según el modo de período */
  const serie = useMemo(() => {
    if (!producto) return [];
    const dias = productosPorDia[producto.nombre] ?? {};
    const acc: Record<string, { unidades: number; ingresos: number }> = {};
    for (const [dia, v] of Object.entries(dias)) {
      const clave = agruparPorMes ? dia.slice(0, 7) : dia;
      if (!acc[clave]) acc[clave] = { unidades: 0, ingresos: 0 };
      acc[clave].unidades += v.unidades;
      acc[clave].ingresos += v.ingresos;
    }
    return Object.entries(acc)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, v]) => ({
        etiqueta: agruparPorMes ? clave : clave.slice(8), // "2026-08" | "14"
        ...v,
      }));
  }, [producto, productosPorDia, agruparPorMes]);

  const kpis = [
    { label: 'Unidades vendidas', valor: fmtUnid(totalUnidades),                                   nota: periodoLabel },
    { label: 'Ticket promedio',   valor: totalPedidos > 0 ? fmtPesos(totalVentas / totalPedidos) : '—', nota: 'por pedido' },
    { label: 'Unid. por pedido',  valor: totalPedidos > 0 ? (totalUnidades / totalPedidos).toFixed(1) : '—', nota: 'promedio' },
    { label: 'Más vendido',       valor: productos[0]?.nombre ?? '—',                              nota: 'por unidades' },
  ];

  const tarjeta = { background: 'var(--card)', border: '1px solid var(--border)' };

  return (
    <div className="space-y-4">
      {/* ── Buscador: lo primero, porque es para lo que existe la pantalla ── */}
      <div className="rounded-2xl p-4" style={tarjeta}>
        <label htmlFor="buscar-producto" className="block text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-2">
          ¿Cuánto se vendió de…?
        </label>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-2, rgba(255,255,255,.04))', border: '1px solid var(--border)' }}>
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            id="buscar-producto"
            type="text"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setSeleccionado(null); }}
            placeholder="Escribí un producto — marraqueta, empanada, hallulla…"
            className="bg-transparent text-[13px] outline-none w-full placeholder-gray-500"
            style={{ color: 'var(--text)' }}
          />
          {busqueda && (
            <button onClick={() => { setBusqueda(''); setSeleccionado(null); }} className="text-gray-400 hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Coincidencias, mientras no haya uno elegido */}
        {busqueda && !producto && (
          <div className="mt-2 max-h-56 overflow-y-auto">
            {filtrados.length === 0 ? (
              <p className="text-[12px] text-gray-400 px-1 py-2">
                Ningún producto coincide con <strong style={{ color: 'var(--text)' }}>{busqueda}</strong> en {periodoLabel}.
              </p>
            ) : filtrados.slice(0, 12).map(p => (
              <button
                key={p.nombre}
                onClick={() => setSeleccionado(p.nombre)}
                className="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-white/5 text-left"
              >
                <span className="text-[13px] truncate" style={{ color: 'var(--text)' }}>{p.nombre}</span>
                <span className="text-[12px] text-gray-400 flex-shrink-0">{fmtUnid(p.unidades)} u · {fmtPesos(p.ingresos)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Ficha del producto elegido ── */}
      {producto && (
        <div className="rounded-2xl p-5" style={tarjeta}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">{producto.categoria}</p>
              <h3 className="text-[20px] font-black leading-tight truncate" style={{ color: 'var(--text)' }}>{producto.nombre}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{periodoLabel}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => descargarCSV(
                  `${producto.nombre}-${periodoLabel}.csv`.replace(/[/\\?%*:|"<>]/g, '-'),
                  [[agruparPorMes ? 'Mes' : 'Día', 'Unidades', 'Ingresos'], ...serie.map(s => [s.etiqueta, s.unidades, Math.round(s.ingresos)])],
                )}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-white/5"
                style={{ border: '1px solid var(--border)', color: 'var(--text-2, #9ca3af)' }}
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => setSeleccionado(null)} className="text-gray-400 hover:text-gray-200 p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Unidades</p>
              <p className="text-[24px] font-black leading-none" style={{ color: 'var(--text)' }}>{fmtUnid(producto.unidades)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Ingresos</p>
              <p className="text-[24px] font-black leading-none" style={{ color: 'var(--text)' }}>{fmtPesos(producto.ingresos)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Precio unitario</p>
              <p className="text-[24px] font-black leading-none" style={{ color: 'var(--text)' }}>
                {producto.unidades > 0 ? fmtPesos(producto.ingresos / producto.unidades) : '—'}
              </p>
            </div>
          </div>

          {serie.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                    formatter={(v) => [fmtUnid(Number(v ?? 0)), 'Unidades'] as [string, string]}
                    labelFormatter={l => agruparPorMes ? `Mes ${l}` : `Día ${l}`}
                  />
                  <Bar dataKey="unidades" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[12px] text-gray-400">Sin ventas de este producto en el período.</p>
          )}

          {producto.porLocalIdentificado && Object.keys(producto.porLocalIdentificado).length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-1">
                Cuánto pidió cada sucursal
              </p>
              <p className="text-[11px] text-gray-400 mb-3">
                Según los pedidos de ConectOca con sucursal identificada. Cubre una parte del total —
                el resto de los pedidos no quedó con ese dato cargado, no es que esa sucursal no haya pedido.
              </p>
              <div className="space-y-1.5">
                {Object.entries(producto.porLocalIdentificado)
                  .sort(([, a], [, b]) => b.unidades - a.unidades)
                  .map(([local, v]) => (
                    <div key={local} className="flex items-center justify-between text-[12px]">
                      <span style={{ color: 'var(--text)' }}>{local}</span>
                      <span className="text-gray-400">{fmtUnid(v.unidades)} un. · {fmtPesos(v.ingresos)}</span>
                    </div>
                  ))}
                {producto.sinIdentificar && (
                  <div className="flex items-center justify-between text-[12px] pt-1.5" style={{ borderTop: '1px dashed var(--border)' }}>
                    <span className="text-gray-400 italic">Sin identificar</span>
                    <span className="text-gray-400 italic">
                      {fmtUnid(producto.sinIdentificar.unidades)} un. · {fmtPesos(producto.sinIdentificar.ingresos)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPIs de la solapa ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={tarjeta}>
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">{k.label}</p>
            <p className="text-[18px] font-black leading-tight truncate" style={{ color: 'var(--text)' }}>
              {cargando ? '…' : k.valor}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">{k.nota}</p>
          </div>
        ))}
      </div>

      {/* ── Tabla completa ── */}
      <div className="rounded-2xl overflow-hidden" style={tarjeta}>
        <div className="flex items-center justify-between gap-3 p-4 pb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
              Todos los productos
            </h3>
            <span className="text-[11px] text-gray-400">({filtrados.length})</span>
          </div>
          <button
            onClick={() => descargarCSV(
              `productos-${periodoLabel}.csv`.replace(/[/\\?%*:|"<>]/g, '-'),
              [['Producto', 'Área', 'Unidades', 'Ingresos'], ...filtrados.map(p => [p.nombre, p.categoria, p.unidades, Math.round(p.ingresos)])],
            )}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-2, #9ca3af)' }}
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>

        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
          {areas.map(a => (
            <button
              key={a}
              onClick={() => setAreaSel(a)}
              className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors',
                areaSel === a ? 'bg-blue-500/15 text-blue-400' : 'text-gray-400 hover:bg-white/5')}
            >
              {a}
            </button>
          ))}
        </div>

        {cargando ? (
          <p className="px-4 pb-4 text-[12px] text-gray-400">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <p className="px-4 pb-4 text-[12px] text-gray-400">
            No hay pedidos que coincidan en {periodoLabel}.
          </p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0" style={{ background: 'var(--card)' }}>
                <tr className="text-gray-400 text-left">
                  <th className="font-semibold px-4 py-2">Producto</th>
                  <th className="font-semibold px-2 py-2 hidden sm:table-cell">Área</th>
                  <th className="font-semibold px-2 py-2 text-right">
                    <button onClick={() => cambiarOrden('unidades')}
                      className={clsx('inline-flex items-center gap-0.5', orden === 'unidades' && 'text-blue-400')}
                      title="Click de nuevo para invertir el orden">
                      Unidades
                      {orden === 'unidades' && (direccion === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="font-semibold px-2 py-2 text-right hidden sm:table-cell">%</th>
                  <th className="font-semibold px-4 py-2 text-right">
                    <button onClick={() => cambiarOrden('ingresos')}
                      className={clsx('inline-flex items-center gap-0.5', orden === 'ingresos' && 'text-blue-400')}
                      title="Click de nuevo para invertir el orden — útil para ver el menos rentable">
                      Ingresos
                      {orden === 'ingresos' && (direccion === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => (
                  <tr
                    key={p.nombre}
                    onClick={() => { setSeleccionado(p.nombre); setBusqueda(p.nombre); }}
                    className="cursor-pointer hover:bg-white/5"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <td className="px-4 py-2 truncate max-w-[14rem]" style={{ color: 'var(--text)' }}>{p.nombre}</td>
                    <td className="px-2 py-2 text-gray-400 hidden sm:table-cell">{p.categoria}</td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--text)' }}>{fmtUnid(p.unidades)}</td>
                    <td className="px-2 py-2 text-right text-gray-400 tabular-nums hidden sm:table-cell">
                      {totalUnidades > 0 ? `${((p.unidades / totalUnidades) * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmtPesos(p.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
