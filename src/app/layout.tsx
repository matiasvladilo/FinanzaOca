import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import { ToastContainer } from '@/components/ui/Toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FinanzasOca — Dashboard Analítico',
  description: 'Dashboard de analítica empresarial para sucursales de panadería',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <Sidebar />
        <div className="ml-[200px] min-h-screen flex flex-col">
          {children}
        </div>
        <ToastContainer />
      </body>
    </html>
  );
}
