/**
 * handlers.ts
 * Ejecuta cada herramienta del asistente virtual. Los nombres de las claves
 * tienen que matchear exacto con los `name` de ASISTENTE_TOOLS en tools.ts.
 *
 * Todas (salvo obtener_informe_periodo, resuelta aparte en el endpoint del
 * chat) llaman funciones en el mismo proceso — nunca HTTP interno.
 */

import { fetchDistribuidoraForReport } from '@/app/api/informes/generate/route';
import { fetchMermaHistoricoCompleto } from '@/app/api/merma-data/route';
import { fetchVentasData } from '@/app/api/ventas/route';
import { buscarProductoPorNombre } from '@/app/api/produccion-data/route';
import { fetchGastoFijoForReport, fetchGastoIndirectoForReport } from '@/lib/gasto-fijo';
import { fetchPresupuesto } from '@/app/api/presupuesto/route';
import { normalizeProveedorName } from '@/lib/data/parsers';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

async function buscarMerma(input: Record<string, unknown>) {
  const producto = str(input.producto).toLowerCase();
  const tipo = str(input.tipo).toLowerCase();
  const local = str(input.local);
  const mesDesde = str(input.mesDesde);
  const mesHasta = str(input.mesHasta);

  const todos = await fetchMermaHistoricoCompleto();
  const filtrados = todos.filter(r => {
    if (producto && !r.producto.toLowerCase().includes(producto)) return false;
    if (tipo && r.tipo.toLowerCase() !== tipo) return false;
    if (local && r.local !== local) return false;
    if (mesDesde && r.mesKey < mesDesde) return false;
    if (mesHasta && r.mesKey > mesHasta) return false;
    return true;
  });

  const total = filtrados.reduce((s, r) => s + r.monto, 0);
  const porProducto: Record<string, number> = {};
  const porLocal: Record<string, number> = {};
  const porMes: Record<string, number> = {};
  for (const r of filtrados) {
    porProducto[r.producto] = (porProducto[r.producto] ?? 0) + r.monto;
    porLocal[r.local] = (porLocal[r.local] ?? 0) + r.monto;
    porMes[r.mesKey] = (porMes[r.mesKey] ?? 0) + r.monto;
  }

  return {
    total,
    registros: filtrados.length,
    porProducto,
    porLocal,
    porMes,
  };
}

async function buscarGastoProveedor(input: Record<string, unknown>) {
  const proveedor = str(input.proveedor).toLowerCase();
  const mesDesde = str(input.mesDesde);
  const mesHasta = str(input.mesHasta);

  const ventasData = await fetchVentasData();
  const registros = ventasData?.registrosDiariosGastos ?? [];

  // normalizeProveedorName solo reescribe alias conocidos (Panadería/Pastelería,
  // Distribuidora Oca); todo lo demás pasa como raw.trim() — por eso agrupamos
  // por minúsculas acá, igual que topProveedores en ventas/route.ts, para no
  // duplicar al mismo proveedor tipeado con distinta capitalización por local.
  const porProveedor: Record<string, { nombre: string; monto: number; local: Record<string, number> }> = {};
  for (const r of registros) {
    const canonico = normalizeProveedorName(r.proveedor);
    const key = canonico.toLowerCase();
    if (proveedor && !key.includes(proveedor)) continue;
    // r.mesKey ya viene precomputado en fetchVentasData() como "YYYY-MM".
    if (mesDesde && r.mesKey < mesDesde) continue;
    if (mesHasta && r.mesKey > mesHasta) continue;
    if (!porProveedor[key]) porProveedor[key] = { nombre: canonico, monto: 0, local: {} };
    porProveedor[key].monto += r.monto;
    porProveedor[key].local[r.sucursal] = (porProveedor[key].local[r.sucursal] ?? 0) + r.monto;
  }

  return Object.values(porProveedor)
    .map(v => ({ nombre: v.nombre, monto: v.monto, porLocal: v.local }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 20);
}

async function obtenerPresupuesto(input: Record<string, unknown>) {
  const local = str(input.local);
  const mesDesde = str(input.mesDesde);
  const mesHasta = str(input.mesHasta);

  const todos = await fetchPresupuesto();
  return todos.filter(r => {
    if (local && r.local !== local) return false;
    const mesKey = `${r.año}-${String(r.mes).padStart(2, '0')}`;
    if (mesDesde && mesKey < mesDesde) return false;
    if (mesHasta && mesKey > mesHasta) return false;
    return true;
  });
}

export const ASISTENTE_HANDLERS: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
  buscar_merma: buscarMerma,
  buscar_gasto_proveedor: buscarGastoProveedor,
  buscar_producto_venta: async (input) =>
    buscarProductoPorNombre(str(input.nombre), str(input.fechaDesde), str(input.fechaHasta)),
  obtener_gasto_fijo: async (input) =>
    fetchGastoFijoForReport(str(input.fechaDesde), str(input.fechaHasta)),
  obtener_gasto_indirecto: async (input) =>
    fetchGastoIndirectoForReport(str(input.fechaDesde), str(input.fechaHasta)),
  obtener_distribuidora: async (input) =>
    fetchDistribuidoraForReport(str(input.fechaDesde), str(input.fechaHasta)),
  obtener_presupuesto: obtenerPresupuesto,
};
