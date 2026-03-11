'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingBag,
  Trash2,
  Settings,
  Gauge,
  BarChart3,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { label: 'Dashboard',      href: '/',             icon: LayoutDashboard },
  { label: 'Factor Índice',  href: '/factor-indice', icon: Gauge },
  { label: 'Ventas',         href: '/ventas',        icon: TrendingUp },
  { label: 'Productos',      href: '/productos',     icon: ShoppingBag },
  { label: 'Merma',          href: '/merma',         icon: Trash2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[200px] bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col z-40 shadow-sm">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight">Admin Panel</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">FinanzasOca</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
              )}
            >
              <Icon
                className={clsx('w-4 h-4 flex-shrink-0',
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            AM
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 truncate">Alex Martinez</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">Super Admin</p>
          </div>
          <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
