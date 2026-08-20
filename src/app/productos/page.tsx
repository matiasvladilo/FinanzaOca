/**
 * /productos ya no existe como sección: los datos de ConectOca que mostraba
 * estaban duplicados con Producción, así que ahora viven como una solapa ahí.
 *
 * Esta ruta se mantiene sólo para no romper links guardados o compartidos.
 * El redirect es temporal a propósito: un 308 se queda cacheado en el navegador
 * para siempre y volver atrás se vuelve un problema.
 */
import { redirect } from 'next/navigation';

export default function ProductosPage() {
  redirect('/produccion?tab=productos');
}
