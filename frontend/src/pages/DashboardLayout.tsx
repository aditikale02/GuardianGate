import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/Sidebar/AppSidebar';
import Topbar from '@/components/Topbar/Topbar';
import { bootstrapSession, getSession, shouldForcePasswordChange, type SessionUser } from '@/lib/session';
import { useEffect, useState } from 'react';
import { UserRole } from '@/lib/constants';
import { canAccessPathForRole } from '@/lib/routing';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<{ role: UserRole; user: SessionUser } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      await bootstrapSession();
      if (!active) return;

      const s = getSession();
      if (!s.role || !s.user || s.role === 'student') {
        navigate('/');
        return;
      }

      if (shouldForcePasswordChange(s.user)) {
        navigate('/auth/change-password');
        return;
      }

      if (!canAccessPathForRole(s.role, location.pathname)) {
        navigate('/admin');
        return;
      }

      setSession({ role: s.role, user: s.user });
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [location.pathname, navigate]);

  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar role={session.role} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar userName={session.user.name} role={session.role} />
          <main className="flex-1 overflow-auto p-6 bg-background">
            <Outlet context={{ role: session.role, user: session.user }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
