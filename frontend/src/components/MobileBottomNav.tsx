import { Home, FileText, Bell, User } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { icon: Bell, label: 'Alerts', path: '/student/notifications' },
  { icon: Home, label: 'Home', path: '/student' },
  { icon: User, label: 'Profile', path: '/student/profile' },
  { icon: FileText, label: 'Requests', path: '/student/request-history' },
];

const MobileBottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border md:hidden">
      <div className="flex items-center justify-around py-2 px-1">
        {navItems.map((item) => {
          const isActive = item.path === '/student'
            ? location.pathname === '/student'
            : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors"
            >
              <item.icon
                className={`h-5 w-5 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
