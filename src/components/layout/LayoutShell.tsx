'use client';

import { usePathname } from 'next/navigation';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') return <>{children}</>;
  return (
    <div className="ml-0 md:ml-[200px] min-h-screen flex flex-col pb-20 md:pb-0">
      {children}
    </div>
  );
}
