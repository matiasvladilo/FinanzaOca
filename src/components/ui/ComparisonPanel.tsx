'use client';

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ padding: '1rem', height: '7rem', background: 'var(--hover)', margin: '1px' }} />
          ))}
        </div>
      </div>
    );
  }

  const cols = metrics.length === 1 ? 1 : metrics.length === 2 ? 2 : 3;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 700 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 20px',
          background: colorA + '1A',
          borderBottom: `2px solid ${colorA}`,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: colorA, flexShrink: 0,
          }} />
          <span style={{ color: colorA, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {labelA}
          </span>
        </div>
        <div style={{
          padding: '12px 16px', flexShrink: 0,
          color: 'var(--text-3)',
          background: 'var(--hover)',
          borderBottom: '2px solid var(--border)',
          fontSize: 16,
        }}>⇄</div>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
          padding: '12px 20px',
          background: colorB + '1A',
          borderBottom: `2px solid ${colorB}`,
        }}>
          <span style={{ color: colorB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
            {labelB}
          </span>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: colorB, flexShrink: 0,
          }} />
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {metrics.map((m, idx) => {
          const a = m.valueA ?? 0;
          const b = m.valueB ?? 0;
          const maxVal = Math.max(a, b, 1);
          const d = b === 0 ? null : ((a - b) / b) * 100;
          const isGood = d === null ? null : (m.higherIsBetter !== false ? d >= 0 : d <= 0);

          return (
            <div key={m.label} style={{
              padding: '1rem',
              borderTop: idx >= cols ? '1px solid var(--border)' : 'none',
              borderLeft: idx % cols !== 0 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Label + delta */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--text-3)',
                }}>
                  {m.label}
                </span>
                {d !== null && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    padding: '2px 8px', borderRadius: 9999,
                    fontSize: 10, fontWeight: 700, flexShrink: 0, marginLeft: 4,
                    background: isGood ? '#dcfce7' : '#fee2e2',
                    color: isGood ? '#15803d' : '#dc2626',
                  }}>
                    {Math.abs(d) < 0.05 ? '→' : d > 0 ? '↑' : '↓'}
                    {' '}{d > 0 ? '+' : ''}{d.toFixed(1)}%
                  </span>
                )}
              </div>

              {/* A bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  flexShrink: 0, background: colorA,
                }} />
                <div style={{
                  flex: 1, height: 6, borderRadius: 9999,
                  overflow: 'hidden', background: 'var(--hover)',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 9999,
                    width: `${(a / maxVal) * 100}%`,
                    background: colorA, transition: 'width 0.7s',
                  }} />
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 800,
                  color: colorA, flexShrink: 0,
                  width: '5.5rem', textAlign: 'right',
                }}>
                  {m.valueA !== null ? m.format(a) : '—'}
                </span>
              </div>

              {/* B bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  flexShrink: 0, background: colorB,
                }} />
                <div style={{
                  flex: 1, height: 6, borderRadius: 9999,
                  overflow: 'hidden', background: 'var(--hover)',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 9999,
                    width: `${(b / maxVal) * 100}%`,
                    background: colorB, transition: 'width 0.7s',
                  }} />
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 800,
                  color: colorB, flexShrink: 0,
                  width: '5.5rem', textAlign: 'right',
                }}>
                  {m.valueB !== null ? m.format(b) : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
