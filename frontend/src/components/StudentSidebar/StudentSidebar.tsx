import {
  User, Package, Users, Moon, Stethoscope, MessageSquare,
  UtensilsCrossed, CalendarCheck, Wrench, Sparkles,
  Calendar, Megaphone, Phone, ClipboardList, AlertTriangle, BedDouble,
  FileText, LayoutDashboard, Bell,
  QrCode,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import Logo from '@/components/Brand/Logo';

const sidebarItems = [
  { title: 'Attendance', icon: CalendarCheck, path: '/student/attendance' },
  { title: 'Contact Warden', icon: Phone, path: '/student/contact' },
  { title: 'Dashboard', icon: LayoutDashboard, path: '/student' },
  { title: 'Emergency', icon: AlertTriangle, path: '/student/emergency' },
  { title: 'Events', icon: Calendar, path: '/student/events' },
  { title: 'Guest Entry', icon: Users, path: '/student/guest' },
  { title: 'Housekeeping', icon: Sparkles, path: '/student/housekeeping' },
  { title: 'Maintenance', icon: Wrench, path: '/student/maintenance' },
  { title: 'Medical', icon: Stethoscope, path: '/student/medical' },
  { title: 'Mess & Food', icon: UtensilsCrossed, path: '/student/mess' },
  { title: 'My Profile', icon: User, path: '/student/profile' },
  { title: 'My Requests', icon: ClipboardList, path: '/student/request-history' },
  { title: 'Notices', icon: Megaphone, path: '/student/notices' },
  { title: 'Notifications', icon: Bell, path: '/student/notifications' },
  { title: 'Out-Pass / Night Leave', icon: Moon, path: '/student/night-leave' },
  { title: 'Parcels', icon: Package, path: '/student/parcels' },
  { title: 'QR Scan', icon: QrCode, path: '/student/qr-scan' },
  { title: 'Room Details', icon: BedDouble, path: '/student/room' },
  { title: 'Suggestions', icon: MessageSquare, path: '/student/suggestions' },
];

const StudentSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

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
              {sidebarItems.map((item) => {
                const isActive = item.path === '/student'
                  ? location.pathname === '/student'
                  : location.pathname.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.path}
                        end={item.path === '/student'}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-soft'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent'
                        }`}
                        activeClassName=""
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
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

export default StudentSidebar;
