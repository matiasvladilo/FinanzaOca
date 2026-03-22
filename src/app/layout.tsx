import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import LayoutShell from '@/components/layout/LayoutShell';
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
        {/* Sin flash: aplica la clase de tema antes de que React hidrate */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}else if(t==='dracula'){document.documentElement.classList.add('dracula')}else if(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <ThemeProvider>
          <Sidebar />
          <LayoutShell>
            {children}
          </LayoutShell>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
