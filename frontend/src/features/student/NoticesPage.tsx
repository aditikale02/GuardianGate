import { motion } from 'framer-motion';
import { Megaphone, Calendar, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type NoticesResponse = {
  rows: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    is_pinned: boolean;
    published_at: string;
  }>;
};

const NoticesPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['campus-notices-student'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/notices');
      return parseJsonOrThrow<NoticesResponse>(response, 'Failed to load notices');
    },
  });

  const notices = data?.rows || [];

  return (
  <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">Notices</h1>
      <p className="text-xs text-muted-foreground mt-0.5">Hostel announcements & circulars</p>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading notices...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {notices.map((n, i) => (
        <motion.div
          key={n.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className={`rounded-2xl p-4 shadow-card ${n.is_pinned ? 'bg-card border-l-4 border-primary' : 'bg-card'}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {n.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
              <Badge className="rounded-full text-[10px] bg-lavender text-lavender-foreground">{n.category}</Badge>
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {new Date(n.published_at).toLocaleDateString()}
            </span>
          </div>
          <h3 className="font-display font-semibold text-sm text-foreground">{n.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{n.content}</p>
        </motion.div>
      ))}
      {!isLoading && notices.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No notices published.</div> : null}
    </div>
  </div>
  );
};

export default NoticesPage;
