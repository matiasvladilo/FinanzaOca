'use client';

/**
 * Explorador de merma: cruza producto × local × mes sobre el histórico completo.
 *
 * Responde preguntas del tipo "cuánto fue la merma de palta este mes", "en qué
 * local se concentra" y "cómo viene mes a mes", que antes obligaban a abrir las
 * cuatro planillas y sumar a mano.
 *
 * Trae los ~1.600 registros una sola vez (scope=todo) y pivotea del lado del
 * cliente: cambiar de producto o de rango es instantáneo y no pega al servidor.
 */

import { useState, useEffect, useMemo } from 'react';
import { Search, X, Table2 } from 'lucide-react';
import { PeriodSelect } from '@/components/ui/PeriodSelect';

interface RegistroMerma {
  id: string;
  producto: string;
  tipo: string;
  monto: number;
  fecha: string;
  local: string;
  mesKey: string;      // "YYYY-MM"
}

const MESES_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const fmtCLP = (v: number) => '$' + Math.round(v).toLocaleString('es-CL');
const mesCorto = (k: string) => {
  const [a, m] = k.split('-');
  return `${MESES_SHORT[parseInt(m, 10)] ?? m} ${a.slice(2)}`;
};
const mesLargo = (k: string) => {
  const [a, m] = k.split('-');
  return `${MESES_LARGO[parseInt(m, 10)] ?? m} ${a}`;
};
/** Minúsculas y sin tildes, para comparar texto tipeado a mano. */
const clave = (s: string) =>
  (s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function ExploradorMerma() {
  const [registros, setRegistros] = useState<RegistroMerma[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState(false);

  const [busqueda, setBusqueda]   = useState('');
  const [tipoSel, setTipoSel]     = useState('');   // '' = todos
  const [localSel, setLocalSel]   = useState('');   // '' = todos
  // Mes concreto, no ventana relativa: "agosto 2026" tiene que dar siempre lo
  // mismo, no depender de qué día se mire el panel. '' = sin fijar todavía
  // (se completa solo apenas llegan los datos, ver efecto más abajo).
  const [mesDesde, setMesDesde]   = useState('');
  const [mesHasta, setMesHasta]   = useState('');

  useEffect(() => {
    let cancelado = false;
    fetch('/api/merma-data?scope=todo')
      .then(r => r.json())
      .then(d => {
        if (cancelado) return;
        if (d?.ok) {
          const regs: RegistroMerma[] = d.registros ?? [];
          setRegistros(regs);
          // Default: los últimos 6 meses con datos, terminando en el más
          // reciente. Se fija sólo una vez, cuando todavía no hay selección
          // (mesHasta === '') — así no le pisa la elección al usuario si
          // vuelve a disparar este efecto.
          const disponibles = [...new Set(regs.map(r => r.mesKey))].filter(Boolean).sort();
          if (disponibles.length) {
            setMesHasta(prev => prev || disponibles[disponibles.length - 1]);
            setMesDesde(prev => prev || disponibles[Math.max(disponibles.length - 6, 0)]);
          }
        } else setError(true);
      })
      .catch(() => { if (!cancelado) setError(true); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, []);

  // Opciones de los selectores, derivadas de los datos
  const tipos = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of registros) if (r.tipo && !m.has(clave(r.tipo))) m.set(clave(r.tipo), r.tipo.trim());
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'es'));
  }, [registros]);

  const locales = useMemo(
    () => [...new Set(registros.map(r => r.local).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [registros],
  );

  // Todos los meses con datos entre mesDesde y mesHasta — las columnas de la
  // matriz. Comparación por string funciona porque el formato es "YYYY-MM".
  const mesesConDatos = useMemo(
    () => [...new Set(registros.map(r => r.mesKey))].filter(k => k && !k.startsWith('0')).sort(),
    [registros],
  );
  const mesesVisibles = useMemo(
    () => mesesConDatos.filter(m => (!mesDesde || m >= mesDesde) && (!mesHasta || m <= mesHasta)),
    [mesesConDatos, mesDesde, mesHasta],
  );

  const filtrados = useMemo(() => {
    const q = clave(busqueda);
    return registros.filter(r => {
      if (tipoSel  && clave(r.tipo)  !== clave(tipoSel))  return false;
      if (localSel && r.local !== localSel)               return false;
      if (!mesesVisibles.includes(r.mesKey))              return false;
      if (q && !clave(r.producto).includes(q))            return false;
      return true;
    });
  }, [registros, busqueda, tipoSel, localSel, mesesVisibles]);

  const total = filtrados.reduce((s, r) => s + r.monto, 0);

  // Matriz local × mes. Es la vista que responde "comparar entre locales y/o
  // entre meses" de una sola mirada.
  const { filas, totalPorMes } = useMemo(() => {
    const porLocal: Record<string, Record<string, number>> = {};
    const porMes: Record<string, number> = {};
    for (const r of filtrados) {
      (porLocal[r.local] ??= {})[r.mesKey] = (porLocal[r.local][r.mesKey] ?? 0) + r.monto;
      porMes[r.mesKey] = (porMes[r.mesKey] ?? 0) + r.monto;
    }
    const filas = Object.entries(porLocal)
      .map(([local, meses]) => ({
        local, meses,
        total: Object.values(meses).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.total - a.total);
    return { filas, totalPorMes: porMes };
  }, [filtrados]);

  // Productos que coinciden, para elegir cuando la búsqueda es amplia
  const productos = useMemo(() => {
    const m: Record<string, { nombre: string; monto: number; veces: number }> = {};
    for (const r of filtrados) {
      const k = clave(r.producto) || '(sin nombre)';
      m[k] ??= { nombre: r.producto.trim() || '(sin nombre)', monto: 0, veces: 0 };
      m[k].monto += r.monto;
      m[k].veces += 1;
    }
    return Object.values(m).sort((a, b) => b.monto - a.monto);
  }, [filtrados]);

  const maxCelda = Math.max(...filas.flatMap(f => Object.values(f.meses)), 1);
  const hayFiltro = !!(busqueda || tipoSel || localSel);

  // Opciones cortas para los dropdowns de mes: el botón de PeriodSelect toma
  // el ancho del label seleccionado, así que "Ago 26" en vez de "Agosto 2026"
  // es lo que evita que la barra de filtros se rompa en pantallas chicas.
  const opcionesMes = mesesConDatos.map(m => ({ label: mesCorto(m), value: m }));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <Table2 className="w-4 h-4 text-blue-600" />
        <h3 className="text-[14px] font-bold text-gray-900">Explorador de merma</h3>
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        Buscá un producto y compará entre locales y meses. Ej.: escribí «palta».
      </p>

      {/* Controles — envuelven en varias filas en pantallas chicas; cada
          control es independiente (no se estira) para que el wrap quede
          prolijo en vez de partir un grupo (ej. "Desde"/"Hasta") por la mitad. */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:min-w-[180px] bg-gray-100 rounded-lg px-3 py-2">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            aria-label="Buscar producto en la merma"
            className="bg-transparent text-[12px] outline-none w-full text-gray-700 placeholder:text-gray-400"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        <PeriodSelect
          label="Tipo"
          value={tipoSel}
          options={tipos.map(t => ({ label: t, value: t }))}
          onChange={setTipoSel}
          allLabel="Todos"
          size="sm"
        />

        {locales.length > 1 && (
          <PeriodSelect
            label="Local"
            value={localSel}
            options={locales.map(l => ({ label: l, value: l }))}
            onChange={setLocalSel}
            allLabel="Todos"
            size="sm"
          />
        )}

        {/* Este par no se separa nunca al hacer wrap: "Desde" solo, sin su
            "Hasta", no dice nada. */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <PeriodSelect
            label="Desde"
            value={mesDesde}
            options={opcionesMes}
            allLabel="Inicio"
            size="sm"
            onChange={v => {
              setMesDesde(v);
              // Si quedaría invertido (desde > hasta), arrastro el otro
              // extremo en vez de mostrar una grilla vacía sin explicación.
              if (v && mesHasta && v > mesHasta) setMesHasta(v);
            }}
          />
          <span className="text-[11px] text-gray-400">–</span>
          <PeriodSelect
            label="Hasta"
            value={mesHasta}
            options={opcionesMes}
            allLabel="Hoy"
            size="sm"
            onChange={v => {
              setMesHasta(v);
              if (v && mesDesde && v < mesDesde) setMesDesde(v);
            }}
          />
        </div>

        {hayFiltro && (
          <button
            type="button"
            onClick={() => { setBusqueda(''); setTipoSel(''); setLocalSel(''); }}
            className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-2"
          >
            Limpiar
          </button>
        )}
      </div>

      {cargando ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : error ? (
        <p className="text-[13px] text-gray-400 text-center py-10">No se pudieron cargar los datos de merma.</p>
      ) : (
        <>
          {/* Resumen de lo que está a la vista */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-3 mb-3 border-b border-gray-100">
            <span className="text-[20px] font-black text-gray-900 leading-none">{fmtCLP(total)}</span>
            <span className="text-[11px] text-gray-500">
              {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
              {' · '}{productos.length} producto{productos.length !== 1 ? 's' : ''}
              {' · '}{filas.length} local{filas.length !== 1 ? 'es' : ''}
              {busqueda ? ` · «${busqueda}»` : ''}
            </span>
          </div>

          {filtrados.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-10">
              Sin merma que coincida con ese filtro
              {mesDesde && mesHasta ? (mesDesde === mesHasta ? ` en ${mesLargo(mesDesde)}` : ` entre ${mesLargo(mesDesde)} y ${mesLargo(mesHasta)}`) : ''}.
            </p>
          ) : (
            <>
              {/* Matriz local × mes */}
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-bold tracking-widest text-gray-400 uppercase pb-2 pr-3">Local</th>
                      {mesesVisibles.map(m => (
                        <th key={m} className="text-right text-[10px] font-bold tracking-widest text-gray-400 uppercase pb-2 px-2 whitespace-nowrap">
                          {mesCorto(m)}
                        </th>
                      ))}
                      <th className="text-right text-[10px] font-bold tracking-widest text-gray-500 uppercase pb-2 pl-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map(f => (
                      <tr key={f.local} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="text-[12px] font-semibold text-gray-800 py-2 pr-3 whitespace-nowrap">{f.local}</td>
                        {mesesVisibles.map(m => {
                          const v = f.meses[m] ?? 0;
                          // Intensidad proporcional: el mes más alto de la
                          // grilla se ve de un vistazo, sin leer los números.
                          const alpha = v > 0 ? 0.06 + (v / maxCelda) * 0.34 : 0;
                          return (
                            <td
                              key={m}
                              className="text-right text-[12px] py-2 px-2 whitespace-nowrap tabular-nums"
                              style={v > 0 ? { backgroundColor: `rgba(37, 99, 235, ${alpha.toFixed(3)})` } : undefined}
                            >
                              {v > 0 ? <span className="font-medium text-gray-800">{fmtCLP(v)}</span> : <span className="text-gray-300">—</span>}
                            </td>
                          );
                        })}
                        <td className="text-right text-[12px] font-bold text-gray-900 py-2 pl-3 whitespace-nowrap tabular-nums">{fmtCLP(f.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 bg-gray-50/60">
                      <td className="text-[12px] font-black text-gray-900 py-2 pr-3">TOTAL</td>
                      {mesesVisibles.map(m => (
                        <td key={m} className="text-right text-[12px] font-bold text-gray-800 py-2 px-2 whitespace-nowrap tabular-nums">
                          {totalPorMes[m] ? fmtCLP(totalPorMes[m]) : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="text-right text-[12.5px] font-black text-gray-900 py-2 pl-3 whitespace-nowrap tabular-nums">{fmtCLP(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Productos que componen lo filtrado */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2.5">
                  {busqueda ? 'Coincidencias' : 'Productos con más merma'}
                </p>
                <div className="space-y-1.5">
                  {productos.slice(0, 10).map(p => (
                    <button
                      key={p.nombre}
                      type="button"
                      onClick={() => setBusqueda(p.nombre)}
                      title={`Filtrar por “${p.nombre}”`}
                      className="w-full flex items-center gap-3 text-left rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-[12px] text-gray-700 truncate flex-1 min-w-0">{p.nombre}</span>
                      {/* Veces y barra sólo desde sm: en mobile alcanza con nombre + monto,
                          y así el nombre no queda reducido a 3 letras en pantallas chicas. */}
                      <span className="hidden sm:inline text-[10.5px] text-gray-400 whitespace-nowrap">{p.veces}×</span>
                      <span className="hidden sm:block w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                        <span
                          className="block h-1.5 bg-blue-500 rounded-full"
                          style={{ width: `${total > 0 ? Math.max((p.monto / total) * 100, 2) : 0}%` }}
                        />
                      </span>
                      <span className="text-[12px] font-bold text-gray-800 w-20 sm:w-24 text-right whitespace-nowrap tabular-nums">{fmtCLP(p.monto)}</span>
                    </button>
                  ))}
                </div>
                {productos.length > 10 && (
                  <p className="text-[10.5px] text-gray-400 mt-2">
                    y {productos.length - 10} producto{productos.length - 10 !== 1 ? 's' : ''} más — afiná la búsqueda para verlos
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
