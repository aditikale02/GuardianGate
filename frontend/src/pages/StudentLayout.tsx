import { Outlet, useNavigate } from 'react-router-dom';
import { bootstrapSession, getSession, logoutSession, shouldForcePasswordChange, type SessionUser } from '@/lib/session';
import { useEffect, useState } from 'react';
import { UserRole } from '@/lib/constants';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Bell, Moon, Sun, LogOut, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Logo from '@/components/Brand/Logo';
import { useDarkMode } from '@/hooks/use-dark-mode';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import StudentSidebar from '@/components/StudentSidebar/StudentSidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

const StudentLayout = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [session, setSession] = useState<{ role: UserRole; user: SessionUser } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      await bootstrapSession();
      if (!active) return;

      const s = getSession();
      if (!s.role || !s.user || s.role !== 'student') {
        navigate('/');
        return;
      }

      if (shouldForcePasswordChange(s.user)) {
        navigate('/auth/change-password');
        return;
      }

      setSession({ role: s.role, user: s.user });
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logoutSession();
    navigate('/');
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        {/* Desktop sidebar - hidden on mobile */}
        {!isMobile && <StudentSidebar />}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {!isMobile && <SidebarTrigger className="text-muted-foreground hover:text-foreground" />}
                <Logo size="sm" />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleDark}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-muted transition-colors"
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => navigate('/student/notifications')}
                  className="relative rounded-xl p-2 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
                </button>

                {/* Profile dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-muted transition-colors outline-none">
                    <Avatar className="h-8 w-8 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {session.user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {!isMobile && (
                      <>
                        <span className="text-sm font-medium text-foreground">{session.user.name}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </>
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem onClick={() => navigate('/student/profile')} className="rounded-lg cursor-pointer">
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="rounded-lg cursor-pointer text-destructive"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto pb-20 md:pb-6">
            <Outlet context={{ role: session.role, user: session.user }} />
          </main>

          {/* Mobile bottom nav - hidden on desktop */}
          {isMobile && <MobileBottomNav />}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default StudentLayout;
