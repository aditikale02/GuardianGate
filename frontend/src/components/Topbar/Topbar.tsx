import { Bell, Search, ChevronDown, LogOut, Moon, Sun } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Logo from '@/components/Brand/Logo';
import { useNavigate } from 'react-router-dom';
import { logoutSession } from '@/lib/session';
import { useDarkMode } from '@/hooks/use-dark-mode';

interface TopbarProps {
  userName: string;
  role: string;
}

const Topbar = ({ userName, role }: TopbarProps) => {
  const navigate = useNavigate();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const handleLogout = async () => {
    await logoutSession();
    navigate('/');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="hidden md:block">
          <Logo size="sm" />
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 rounded-xl bg-muted px-4 py-2 max-w-md flex-1 mx-8">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search students, records..."
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleDark}
          className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button className="relative rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-muted transition-colors outline-none">
            <Avatar className="h-8 w-8 border-2 border-primary/20">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {userName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={() => navigate('/admin/profile')} className="rounded-lg cursor-pointer">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/admin/settings')} className="rounded-lg cursor-pointer">
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="rounded-lg cursor-pointer text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Topbar;
