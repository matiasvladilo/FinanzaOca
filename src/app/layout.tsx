import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import { ToastContainer } from '@/components/ui/Toast';
import { ThemeProvider } from '@/providers/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FinanzasOca — Dashboard Analítico',
  description: 'Dashboard de analítica empresarial para sucursales de panadería',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Script inline: aplica .dark ANTES del render para evitar flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-[var(--bg-base)] min-h-screen`}>
        <ThemeProvider>
          <Sidebar />
          <div className="ml-[200px] min-h-screen flex flex-col">
            {children}
          </div>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
