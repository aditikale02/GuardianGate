import { motion } from 'framer-motion';
import { Bell, Package, Moon, CreditCard, Calendar, AlertTriangle, Megaphone, Stethoscope } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

interface Notification {
  id: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  color: string;
}

type NotificationsResponse = {
  unread?: number;
  rows?: Array<{
    id: string;
    title?: string;
    message?: string;
    desc?: string;
    level?: 'INFO' | 'WARNING' | 'CRITICAL';
    at?: string;
    created_at?: string;
    time?: string;
    read?: boolean;
    is_read?: boolean;
  }>;
  items?: Array<{
    id: string;
    title?: string;
    message?: string;
    desc?: string;
    level?: 'INFO' | 'WARNING' | 'CRITICAL';
    at?: string;
    created_at?: string;
    time?: string;
    read?: boolean;
    is_read?: boolean;
  }>;
};

const levelIconMap: Record<string, LucideIcon> = {
  CRITICAL: AlertTriangle,
  WARNING: Megaphone,
  INFO: Bell,
};

const levelColorMap: Record<string, string> = {
  CRITICAL: 'bg-destructive/15',
  WARNING: 'bg-peach',
  INFO: 'bg-lavender',
};

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const StudentNotificationsPage = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-notifications'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/notifications');
      return parseJsonOrThrow<NotificationsResponse>(response, 'Unable to load notifications');
    },
  });

  const markOneMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await authenticatedFetch(`/dashboard/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      await parseJsonOrThrow(response, 'Failed to mark notification as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/dashboard/notifications/read-all', {
        method: 'POST',
      });
      await parseJsonOrThrow(response, 'Failed to mark all notifications as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-notifications'] });
    },
  });

  const sourceRows = data?.rows || data?.items || [];

  const notifications: Notification[] = sourceRows.map((row) => {
    const icon = levelIconMap[row.level] || Bell;
    const color = levelColorMap[row.level] || 'bg-lavender';
    const at = row.at || row.created_at || row.time || new Date().toISOString();
    const read = row.read ?? row.is_read ?? false;
    return {
      id: row.id,
      icon,
      title: row.title || 'Notification',
      desc: row.message || row.desc || 'No details provided.',
      time: formatRelativeTime(at),
      read,
      color,
    };
  });

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Notifications</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data?.unread ?? 0} unread</p>
        </div>
        <button
          className="text-xs text-primary font-medium"
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending || isLoading}
        >
          {markAllMutation.isPending ? 'Updating...' : 'Mark all read'}
        </button>
      </div>

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading notifications...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="space-y-2">
        {notifications.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-2xl p-4 shadow-card flex items-start gap-3 ${n.read ? 'bg-card opacity-70' : 'bg-card'}`}
            onClick={() => {
              if (!n.read) {
                markOneMutation.mutate(n.id);
              }
            }}
          >
            <div className={`rounded-xl ${n.color} p-2 shrink-0`}>
              <n.icon className="h-4 w-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <p className={`text-sm text-foreground ${!n.read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
            </div>
          </motion.div>
        ))}
        {!isLoading && !error && notifications.length === 0 ? (
          <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No notifications available.</div>
        ) : null}
      </div>
    </div>
  );
};

export default StudentNotificationsPage;
