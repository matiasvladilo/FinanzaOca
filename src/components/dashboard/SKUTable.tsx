'use client';

import Link from 'next/link';
import { ArrowUpRight, TrendingUp, TrendingDown, ShoppingBag } from 'lucide-react';
import clsx from 'clsx';
import type { ProductoSKU } from '@/types';
import { formatCLPFull } from '@/lib/mock-data';

interface Props {
  data: ProductoSKU[];
}

export default function SKUTable({ data }: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900">Auditoría de Rendimiento SKU</h3>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
            Productos top por ingresos
          </p>
        </div>
        <Link href="/productos" className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold hover:text-blue-800 transition-colors">
          Análisis completo
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-4 gap-3 pb-2 border-b border-gray-100">
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Producto</p>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase text-right">Unidades</p>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase text-right">Ingresos</p>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase text-right">Tendencia</p>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50">
        {data.map((producto) => (
          <div
            key={producto.id}
            className="grid grid-cols-4 gap-3 py-3.5 items-center hover:bg-gray-50/50 rounded-lg transition-colors"
          >
            {/* Producto */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-4 h-4 text-gray-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 truncate">{producto.nombre}</p>
                <p className="text-[10px] text-gray-400">ID: {producto.id}</p>
              </div>
            </div>

            {/* Unidades */}
            <p className="text-[13px] font-semibold text-gray-700 text-right">
              {producto.unidades.toLocaleString('es-CL')}
            </p>

            {/* Ingresos */}
            <p className="text-[13px] font-semibold text-gray-800 text-right">
              {formatCLPFull(producto.ingresosBrutos)}
            </p>

            {/* Tendencia */}
            <div className="flex items-center justify-end gap-1">
              {producto.tendencia >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              )}
              <span
                className={clsx(
                  'text-[12px] font-bold',
                  producto.tendencia >= 0 ? 'text-green-600' : 'text-red-500'
                )}
              >
                {producto.tendencia > 0 ? '+' : ''}{producto.tendencia}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
