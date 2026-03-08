import { useState } from 'react';
import { cn } from '@/lib/utils';
import AppSidebar from './AppSidebar';
import Topbar from './Topbar';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile unless open */}
      <div className={cn('hidden md:block')}>
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>
      {mobileOpen && (
        <div className="md:hidden">
          <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className={cn('transition-all duration-300', collapsed ? 'md:ml-16' : 'md:ml-60')}>
        <Topbar onMenuClick={() => setMobileOpen(!mobileOpen)} title={title} />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
