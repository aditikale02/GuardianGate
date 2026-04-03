import { Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type NotificationsResponse = {
  unread: number;
  rows: Array<{
    id: string;
    title: string;
    message: string;
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    at: string;
    read: boolean;
  }>;
};

const levelStyleMap: Record<string, { icon: LucideIcon; color: string }> = {
  CRITICAL: { icon: AlertTriangle, color: 'bg-blush' },
  WARNING: { icon: Info, color: 'bg-peach' },
  INFO: { icon: CheckCircle, color: 'bg-lavender' },
};

const toRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const NotificationsPage = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/notifications');
      return parseJsonOrThrow<NotificationsResponse>(response, 'Failed to load notifications');
    },
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      const response = await authenticatedFetch(`/dashboard/notifications/${id}/read`, { method: 'POST' });
      await parseJsonOrThrow(response, 'Failed to update notification');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  const notifications = (data?.rows || []).map((row) => {
    const style = levelStyleMap[row.level] || levelStyleMap.INFO;
    return {
      id: row.id,
      icon: style.icon,
      title: row.title,
      desc: row.message,
      time: toRelative(row.at),
      color: style.color,
      read: row.read,
    };
  });

  return (
  <div className="max-w-3xl space-y-6">
    <h1 className="font-display text-2xl font-bold text-foreground">Notifications</h1>
    <p className="text-sm text-muted-foreground">Stay updated on hostel activities ({data?.unread ?? 0} unread)</p>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading notifications...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {notifications.map((n, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-2xl bg-card shadow-card p-4 flex items-start gap-4 hover:shadow-hover transition-shadow cursor-pointer"
          onClick={() => {
            if (!n.read) {
              markOne.mutate(n.id);
            }
          }}
        >
          <div className={`rounded-xl p-2.5 ${n.color} shrink-0`}>
            <n.icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">{n.title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{n.desc}</p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{n.time}</span>
        </motion.div>
      ))}
      {!isLoading && notifications.length === 0 ? (
        <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No notifications available.</div>
      ) : null}
    </div>
  </div>
  );
};

export default NotificationsPage;
