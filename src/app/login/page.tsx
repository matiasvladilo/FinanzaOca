'use client';

/**
 * Login corporativo "La Oca" — mismo lenguaje visual que el resto de la app
 * (ver .claude/skills/la-oca-style): panel de marca navy con el wordmark a la
 * izquierda y formulario sobre blanco a la derecha. En mobile el panel navy
 * se reduce a una franja superior con el wordmark.
 *
 * La lógica de autenticación no cambia: POST /api/auth/login y, si responde
 * ok, navegación completa a "/" para que el middleware lea la cookie nueva.
 */

import { useState } from 'react';
import Image from 'next/image';
import {
  User, Lock, Eye, EyeOff, AlertCircle, Loader2,
  BarChart3, Wallet, ShieldCheck, ArrowRight,
} from 'lucide-react';

const PILARES = [
  { icon: BarChart3,   text: 'Ventas, gastos y merma de todos los locales en un solo lugar' },
  { icon: Wallet,      text: 'Factor Índice y presupuesto medidos por caja, mes a mes' },
  { icon: ShieldCheck, text: 'Acceso por usuario y local, con datos protegidos' },
] as const;

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message ?? 'Credenciales incorrectas');
        setLoading(false);
      } else {
        window.location.href = '/';
      }
    } catch {
      setErrorMsg('Error de conexión');
      setLoading(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-[var(--border-2)] text-[var(--text)] bg-white pl-11 pr-4 py-3 text-[14px] outline-none transition ' +
    'placeholder:text-gray-400 focus:border-[var(--brand-navy)] focus:ring-4 focus:ring-[rgba(5,59,132,0.10)]';

  return (
    // fixed + z alto: el login tapa cualquier elemento global del layout.
    <div className="fixed inset-0 z-[9999] flex flex-col md:flex-row overflow-y-auto"
      style={{ background: 'var(--bg)' }}>

      {/* ── Panel de marca ─────────────────────────────────────────────── */}
      <aside className="relative overflow-hidden md:w-[44%] lg:w-[46%] shrink-0 flex flex-col justify-between px-6 py-6 md:px-12 md:py-12"
        style={{ background: 'var(--brand-navy)' }}>

        {/* Gráfico abstracto de fondo: líneas de tendencia muy tenues */}
        <svg aria-hidden className="hidden md:block absolute inset-x-0 bottom-0 w-full h-[55%] pointer-events-none"
          viewBox="0 0 400 220" preserveAspectRatio="none">
          {[0, 1, 2, 3].map(i => (
            <line key={i} x1="0" x2="400" y1={40 + i * 50} y2={40 + i * 50} stroke="white" strokeOpacity="0.06" />
          ))}
          <path d="M0 190 C 60 175, 90 150, 140 155 S 230 110, 280 95 S 360 50, 400 35 L 400 220 L 0 220 Z"
            fill="white" fillOpacity="0.04" />
          <path d="M0 190 C 60 175, 90 150, 140 155 S 230 110, 280 95 S 360 50, 400 35"
            fill="none" stroke="white" strokeOpacity="0.22" strokeWidth="1.5" />
          <path d="M0 205 C 70 200, 120 185, 170 188 S 260 160, 310 150 S 370 120, 400 112"
            fill="none" stroke="white" strokeOpacity="0.10" strokeWidth="1.2" />
        </svg>

        <div className="relative">
          <Image
            src="/brand/la-oca-wordmark.png"
            alt="La Oca"
            width={1536}
            height={364}
            priority
            className="h-8 md:h-11 w-auto select-none"
          />
        </div>

        <div className="relative hidden md:block max-w-md">
          <div className="h-1 w-10 rounded-full mb-6" style={{ background: 'var(--brand-mustard)' }} />
          <h2 className="text-[30px] lg:text-[34px] font-bold leading-tight text-white tracking-tight">
            Centro financiero
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">
            La información financiera de La Oca, clara y al día, para decidir con datos.
          </p>
          <ul className="mt-9 space-y-4">
            {PILARES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4 text-white" strokeWidth={1.75} />
                </span>
                <span className="text-[14px] leading-snug text-white/85 pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative hidden md:block text-[12px] text-white/45">
          © {new Date().getFullYear()} La Oca · FinanzasOca
        </p>
      </aside>

      {/* ── Formulario ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-5 py-10 md:px-10">
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl bg-white px-6 py-8 sm:px-9 sm:py-10"
            style={{ border: '1px solid var(--border-2)', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(5,59,132,0.12)' }}>

            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-navy-soft)' }}>
              FinanzasOca
            </p>
            <h1 className="mt-2 text-[24px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Iniciar sesión
            </h1>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--text-2)' }}>
              Ingresa con tu usuario corporativo.
            </p>

            {errorMsg && (
              <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px]"
                style={{ background: '#fbf1f1', border: '1px solid var(--risk-border)', color: 'var(--risk-text)' }}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="login-user" className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                  Usuario
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                  <input
                    id="login-user"
                    type="text"
                    autoComplete="username"
                    placeholder="Tu usuario"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-pass" className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                  <input
                    id="login-pass"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`${inputCls} pr-11`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors hover:text-[var(--brand-navy)]"
                  >
                    {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white transition bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-dark)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando…</>
                  : <>Ingresar <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Acceso restringido a personal autorizado
          </p>
        </div>
      </main>
    </div>
  );
}
