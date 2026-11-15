import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import LayoutShell from '@/components/layout/LayoutShell';
import { ToastContainer } from '@/components/ui/Toast';
import AsistenteBubble from '@/components/asistente/AsistenteBubble';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FinanzasOca — Dashboard Analítico',
  description: 'Dashboard de analítica empresarial para sucursales de panadería',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <Sidebar />
        <LayoutShell>
          {children}
        </LayoutShell>
        <ToastContainer />
        <AsistenteBubble />
      </body>
    </html>
  );
}
