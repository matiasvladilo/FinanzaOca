'use client';

interface FactorGaugeProps {
  /** Índice actual (ej. 96.8). null mientras no hay dato. */
  value: number | null;
  threshold?: number;
  optimized: boolean;
  loading?: boolean;
}

const SIZE = 160;
const STROKE = 14;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = CX - STROKE;
const GAUGE_START = -90; // extremo izquierdo del arco (0%)
const GAUGE_END = 90;    // extremo derecho del arco (100% del máximo)

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function angleForPct(pct: number) {
  const clamped = Math.max(0, Math.min(1, pct));
  return GAUGE_START + clamped * (GAUGE_END - GAUGE_START);
}

export default function FactorGauge({ value, threshold = 60, optimized, loading }: FactorGaugeProps) {
  const safeValue = value ?? 0;
  const max = Math.max(threshold * 2, Math.ceil((safeValue * 1.15) / 10) * 10);
  const pct = safeValue / max;
  const thresholdPct = threshold / max;

  const valueAngle = angleForPct(pct);
  const thresholdAngle = angleForPct(thresholdPct);
  const thresholdP1 = polarToCartesian(CX, CY, R - STROKE / 2 - 3, thresholdAngle);
  const thresholdP2 = polarToCartesian(CX, CY, R + STROKE / 2 + 3, thresholdAngle);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE / 2 + STROKE}`} width="100%" style={{ maxWidth: 140, display: 'block', margin: '0 auto' }}
      role="img" aria-label={loading || value === null ? 'Factor Índice cargando' : `Factor Índice ${value}%`}>
      <path d={describeArc(CX, CY, R, GAUGE_START, GAUGE_END)} fill="none"
        stroke="var(--hover)" strokeWidth={STROKE} strokeLinecap="round" />
      {!loading && value !== null && (
        <>
          <path d={describeArc(CX, CY, R, GAUGE_START, valueAngle)} fill="none"
            stroke={optimized ? '#22C55E' : '#EF4444'} strokeWidth={STROKE} strokeLinecap="round" />
          <line x1={thresholdP1.x} y1={thresholdP1.y} x2={thresholdP2.x} y2={thresholdP2.y}
            stroke="var(--text-3)" strokeWidth={2} />
        </>
      )}
    </svg>
  );
}
