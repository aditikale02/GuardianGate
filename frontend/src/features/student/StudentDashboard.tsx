import { motion } from 'framer-motion';
import {
  User, Package, Users, Moon, Stethoscope, MessageSquare,
  UtensilsCrossed, CalendarCheck, Wrench, Sparkles,
  Calendar, Megaphone, Phone, ClipboardList, AlertTriangle, BedDouble, FileText,
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { UserRole } from '@/lib/constants';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.35 },
  }),
};

const modules = [
  { icon: User, label: 'My Profile', path: '/student/profile', color: 'bg-peach' },
  { icon: Wrench, label: 'Maintenance', path: '/student/maintenance', color: 'bg-mint' },
  { icon: Sparkles, label: 'Housekeeping', path: '/student/housekeeping', color: 'bg-lavender' },
  { icon: Package, label: 'Parcels', path: '/student/parcels', color: 'bg-peach' },
  { icon: Users, label: 'Guest Entry', path: '/student/guest', color: 'bg-mint' },
  { icon: FileText, label: 'Out-Pass', path: '/student/night-leave', color: 'bg-lavender' },
  { icon: Moon, label: 'Night Leave', path: '/student/night-leave', color: 'bg-blush' },
  { icon: Stethoscope, label: 'Medical', path: '/student/medical', color: 'bg-mint' },
  { icon: Phone, label: 'Contact Warden', path: '/student/contact', color: 'bg-peach' },
  { icon: UtensilsCrossed, label: 'Mess & Food', path: '/student/mess', color: 'bg-lavender' },
  { icon: CalendarCheck, label: 'Attendance', path: '/student/attendance', color: 'bg-peach' },
  { icon: Megaphone, label: 'Notices', path: '/student/notices', color: 'bg-lavender' },
  { icon: Calendar, label: 'Events', path: '/student/events', color: 'bg-mint' },
  { icon: MessageSquare, label: 'Suggestions', path: '/student/suggestions', color: 'bg-blush' },
  { icon: BedDouble, label: 'Room Details', path: '/student/room', color: 'bg-peach' },
  { icon: ClipboardList, label: 'My Requests', path: '/student/request-history', color: 'bg-lavender' },
  { icon: AlertTriangle, label: 'Emergency', path: '/student/emergency', color: 'bg-blush' },
];

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useOutletContext<{ role: UserRole; user: { name: string; email: string } }>();

  return (
    <div className="px-4 py-5 max-w-lg mx-auto">
      {/* Welcome section */}
      <motion.div
        initial="hidden" animate="visible" variants={fadeUp} custom={0}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-12 w-12 border-2 border-primary/30">
            <AvatarFallback className="bg-primary text-primary-foreground font-display font-bold text-lg">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground">Welcome back,</p>
            <h1 className="font-display text-lg font-bold text-foreground">{user.name}</h1>
          </div>
        </div>

        {/* Info strip */}
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-primary/10 text-primary px-3 py-1 font-medium">Block A</span>
          <span className="rounded-full bg-mint/80 text-mint-foreground px-3 py-1 font-medium">Room 204</span>
          <span className="rounded-full bg-peach/80 text-peach-foreground px-3 py-1 font-medium">CSE - 3rd Year</span>
        </div>
      </motion.div>

      {/* Emergency banner */}
      <motion.div
        initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 mb-6"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Water supply disruption</p>
            <p className="text-xs text-muted-foreground mt-0.5">Block A — Expected fix by 2:00 PM today</p>
          </div>
        </div>
      </motion.div>

      {/* Feature card grid */}
      <div className="grid grid-cols-3 gap-3">
        {modules.map((mod, i) => (
          <motion.button
            key={mod.label}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={i + 3}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(mod.path)}
            className={`${mod.color} rounded-2xl p-4 flex flex-col items-center gap-2.5 shadow-card transition-all active:shadow-none`}
          >
            <div className="rounded-xl bg-card/70 p-3 shadow-sm">
              <mod.icon className="h-6 w-6 text-foreground" />
            </div>
            <span className="text-[11px] font-semibold text-foreground leading-tight text-center">
              {mod.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default StudentDashboard;
