import {
  LayoutDashboard, QrCode, CalendarCheck, Bell, User,
  FileText, Inbox, BarChart3, Settings, GraduationCap, Shield,
  Package, Stethoscope, Wrench, Sparkles, UtensilsCrossed,
  CreditCard, Calendar, MessageSquare, Megaphone, AlertTriangle,
  UserCheck, Users,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import Logo from '@/components/Brand/Logo';
import { SIDEBAR_ITEMS, UserRole } from '@/lib/constants';
import { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, QrCode, CalendarCheck, Bell, User,
  FileText, Inbox, BarChart3, Settings, GraduationCap, Shield,
  Package, Stethoscope, Wrench, Sparkles, UtensilsCrossed,
  CreditCard, Calendar, MessageSquare, Megaphone, AlertTriangle,
  UserCheck, Users,
};

interface AppSidebarProps {
  role: UserRole;
}

const AppSidebar = ({ role }: AppSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const items = SIDEBAR_ITEMS[role];

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar pt-4">
        {!collapsed && (
          <div className="px-4 pb-4">
            <Logo size="sm" />
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {items.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive = item.path === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.path}
                        end={item.path === '/admin'}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-soft'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent'
                        }`}
                        activeClassName=""
                      >
                        {Icon && <Icon className="h-5 w-5 shrink-0" />}
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
