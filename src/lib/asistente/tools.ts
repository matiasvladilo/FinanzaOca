/**
 * tools.ts
 * Definición de las 8 herramientas que puede usar el asistente virtual.
 * Cada nombre acá tiene que tener un handler con el mismo nombre en
 * handlers.ts (ver ASISTENTE_HANDLERS) — el dispatcher del endpoint del chat
 * los busca por nombre.
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages';

const FECHA_DESC = 'Formato YYYY-MM-DD.';

export const ASISTENTE_TOOLS: Tool[] = [
  {
    name: 'obtener_informe_periodo',
    description: 'KPIs completos de un período: ventas, gastos, margen, índice 60, desglose por sucursal, top proveedores y alertas automáticas. Es la herramienta principal para preguntas generales de un rango de fechas.',
    input_schema: {
      type: 'object',
      properties: {
        fechaDesde: { type: 'string', description: `Inicio del período. ${FECHA_DESC}` },
        fechaHasta: { type: 'string', description: `Fin del período. ${FECHA_DESC}` },
        sucursal: { type: 'string', description: 'Nombre exacto de una sucursal ("La Reina", "PV", "PT", "Bilbao") para filtrar a una sola. Omitir para todas.' },
      },
      required: ['fechaDesde', 'fechaHasta'],
    },
  },
  {
    name: 'buscar_merma',
    description: 'Busca en TODO el histórico de merma (no solo un período corto) filtrando por producto, tipo, local y/o rango de meses. Usar para preguntas de merma de un producto específico, o para comparar merma entre meses distintos.',
    input_schema: {
      type: 'object',
      properties: {
        producto: { type: 'string', description: 'Substring del nombre del producto a buscar (ej. "palta"). Omitir para no filtrar por producto.' },
        tipo: { type: 'string', description: 'Tipo de merma exacto (ej. "Corporativo", "Verdura", "Produccion"). Omitir para no filtrar por tipo.' },
        local: { type: 'string', description: 'Nombre exacto de una sucursal ("La Reina", "PV", "PT", "Bilbao") para filtrar a una sola. Omitir para todas.' },
        mesDesde: { type: 'string', description: 'Mes de inicio, formato YYYY-MM. Omitir para desde el principio del histórico.' },
        mesHasta: { type: 'string', description: 'Mes de fin, formato YYYY-MM. Omitir para hasta el mes más reciente.' },
      },
      required: [],
    },
  },
  {
    name: 'buscar_gasto_proveedor',
    description: 'Busca en el histórico de gastos de los 4 locales agrupado por proveedor (ya con los nombres tipeados a mano unificados). Usar para preguntas tipo "cuánto le compramos a X proveedor".',
    input_schema: {
      type: 'object',
      properties: {
        proveedor: { type: 'string', description: 'Substring del nombre del proveedor (ej. "central mayorista"). Omitir para traer el ranking completo.' },
        mesDesde: { type: 'string', description: 'Mes de inicio, formato YYYY-MM. Omitir para desde el principio del histórico.' },
        mesHasta: { type: 'string', description: 'Mes de fin, formato YYYY-MM. Omitir para hasta el mes más reciente.' },
      },
      required: [],
    },
  },
  {
    name: 'buscar_producto_venta',
    description: 'Busca un producto específico por nombre en TODO el catálogo de ventas de ConectOca (Producción) — no solo el top 15 más vendido. Usar para preguntas sobre un producto puntual, incluida su participación porcentual sobre el total (para eso, llamar también a obtener_informe_periodo del mismo rango y calcular el % vos mismo).',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Substring del nombre del producto (ej. "sopaipilla").' },
        fechaDesde: { type: 'string', description: `Inicio del período. ${FECHA_DESC}` },
        fechaHasta: { type: 'string', description: `Fin del período. ${FECHA_DESC}` },
      },
      required: ['nombre', 'fechaDesde', 'fechaHasta'],
    },
  },
  {
    name: 'obtener_gasto_fijo',
    description: 'Costos fijos por local en un período (arriendo, servicios, etc.).',
    input_schema: {
      type: 'object',
      properties: {
        fechaDesde: { type: 'string', description: `Inicio del período. ${FECHA_DESC}` },
        fechaHasta: { type: 'string', description: `Fin del período. ${FECHA_DESC}` },
      },
      required: ['fechaDesde', 'fechaHasta'],
    },
  },
  {
    name: 'obtener_gasto_indirecto',
    description: 'Gasto indirecto por categoría en un período.',
    input_schema: {
      type: 'object',
      properties: {
        fechaDesde: { type: 'string', description: `Inicio del período. ${FECHA_DESC}` },
        fechaHasta: { type: 'string', description: `Fin del período. ${FECHA_DESC}` },
      },
      required: ['fechaDesde', 'fechaHasta'],
    },
  },
  {
    name: 'obtener_distribuidora',
    description: 'Cuánto compró Distribuidora a proveedores externos en un período, y a quién. No incluye lo que le compraron los locales a Distribuidora — para eso usar buscar_gasto_proveedor con proveedor="distribuidora".',
    input_schema: {
      type: 'object',
      properties: {
        fechaDesde: { type: 'string', description: `Inicio del período. ${FECHA_DESC}` },
        fechaHasta: { type: 'string', description: `Fin del período. ${FECHA_DESC}` },
      },
      required: ['fechaDesde', 'fechaHasta'],
    },
  },
  {
    name: 'obtener_presupuesto',
    description: 'Presupuesto cargado por local y mes, para comparar contra lo real (usar obtener_informe_periodo para lo real del mismo local/mes).',
    input_schema: {
      type: 'object',
      properties: {
        local: { type: 'string', description: 'Nombre exacto de una sucursal ("La Reina", "PV", "PT", "Bilbao") para filtrar a una sola. Omitir para todas.' },
        mesDesde: { type: 'string', description: 'Mes de inicio, formato YYYY-MM. Omitir para desde el principio.' },
        mesHasta: { type: 'string', description: 'Mes de fin, formato YYYY-MM. Omitir para hasta el final.' },
      },
      required: [],
    },
  },
];
