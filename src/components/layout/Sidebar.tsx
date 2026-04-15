'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getClientSession } from '@/lib/session-client';
import {
  LayoutDashboard, TrendingUp, ShoppingBag,
  Trash2, LogOut, Gauge, BarChart3, Factory, FileText,
} from 'lucide-react';

interface SessionUser { username: string; role: string; }

function getSession(): SessionUser | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').find(c => c.trim().startsWith('session='));
  if (!match) return null;
  try { return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('='))); }
  catch { return null; }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

const navItems = [
  { label: 'Dashboard',     href: '/',              icon: LayoutDashboard },
  { label: 'Factor Índice', href: '/factor-indice', icon: Gauge },
  { label: 'Ventas',        href: '/ventas',         icon: TrendingUp },
  { label: 'Productos',     href: '/productos',      icon: ShoppingBag },
  { label: 'Merma',         href: '/merma',          icon: Trash2 },
  { label: 'Producción',    href: '/produccion',     icon: Factory },
  { label: 'Informes',      href: '/informes',       icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLocalRole, setIsLocalRole] = useState(false);

  useEffect(() => {
    setUser(getSession());
    const s = getClientSession();
    setIsLocalRole(s?.role === 'local');
  }, []);

  const visibleNavItems = isLocalRole
    ? navItems.filter(i => i.href === '/ventas')
    : navItems;

  if (pathname === '/login') return null;

  return (
    <>
      {/* ── Desktop sidebar (md+) ─────────────────────────────────────────── */}
      <aside
        className="fixed left-0 top-0 h-screen w-[200px] flex-col z-40 shadow-sm border-r transition-colors hidden md:flex"
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text)' }}>Admin Panel</p>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--text-3)' }}>FinanzasOca</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150"
                style={active
                  ? { background: 'var(--active-bg)', color: 'var(--active-text)' }
                  : { color: 'var(--text-3)' }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-3)'; } }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? 'var(--active-text)' : 'var(--text-3)' }} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>{user?.username ?? '–'}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-3)' }}>{user?.role ?? ''}</p>
            </div>
            <button onClick={logout} title="Cerrar sesión" className="flex-shrink-0 transition-colors hover:text-red-500" style={{ color: 'var(--text-3)' }}>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom navigation (< md) ──────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden border-t overflow-hidden"
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          willChange: 'transform',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {visibleNavItems.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          const shortLabel: Record<string, string> = {
            'Factor Índice': 'Factor',
            'Dashboard': 'Inicio',
            'Producción': 'Produc.',
          };
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 min-w-0 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors"
              style={{ color: active ? 'var(--active-text)' : 'var(--text-3)' }}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-[8px] font-semibold tracking-wide truncate w-full text-center px-0.5">
                {shortLabel[label] ?? label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
