import { motion } from 'framer-motion';
import { ClipboardList, Package, Users, Moon, Stethoscope, Wrench, Sparkles, MessageSquare, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

interface RequestItem {
  id: string;
  type: string;
  icon: LucideIcon;
  title: string;
  date: string;
  status: string;
  color: string;
}

type RequestHistoryResponse = {
  rows: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    date: string;
  }>;
};

const iconByType: Record<string, LucideIcon> = {
  Leave: Moon,
  Parcel: Package,
  Medical: Stethoscope,
  Maintenance: Wrench,
  Guest: Users,
  Housekeeping: Sparkles,
  Suggestion: MessageSquare,
  'Missing Report': FileText,
};

const colorByType: Record<string, string> = {
  Leave: 'bg-blush',
  Parcel: 'bg-peach',
  Medical: 'bg-mint',
  Maintenance: 'bg-peach',
  Guest: 'bg-mint',
  Housekeeping: 'bg-lavender',
  Suggestion: 'bg-lavender',
  'Missing Report': 'bg-blush',
};

const statusColors: Record<string, string> = {
  pending: 'bg-peach text-peach-foreground',
  approved: 'bg-mint text-mint-foreground',
  rejected: 'bg-destructive/15 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
  ready: 'bg-mint text-mint-foreground',
  assigned: 'bg-lavender text-lavender-foreground',
  'in progress': 'bg-lavender text-lavender-foreground',
  completed: 'bg-muted text-muted-foreground',
  open: 'bg-peach text-peach-foreground',
  resolved: 'bg-mint text-mint-foreground',
  'pickup requested': 'bg-peach text-peach-foreground',
  notified: 'bg-lavender text-lavender-foreground',
  collected: 'bg-mint text-mint-foreground',
  responded: 'bg-mint text-mint-foreground',
  'in review': 'bg-lavender text-lavender-foreground',
  found: 'bg-mint text-mint-foreground',
  closed: 'bg-muted text-muted-foreground',
};

const RequestHistoryPage = () => {
  const [filter, setFilter] = useState('All');

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-request-history'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/requests/my');
      return parseJsonOrThrow<RequestHistoryResponse>(response, 'Failed to load request history');
    },
  });

  const allRequests: RequestItem[] = useMemo(
    () =>
      (data?.rows || []).map((row) => {
        const normalizedStatus = row.status.replace(/_/g, ' ').toLowerCase();
        return {
          id: row.id,
          type: row.type,
          icon: iconByType[row.type] || ClipboardList,
          title: row.title,
          date: row.date,
          status: normalizedStatus,
          color: colorByType[row.type] || 'bg-muted',
        };
      }),
    [data],
  );

  const rows = filter === 'All' ? allRequests : allRequests.filter((row) => row.type === filter);

  return (
  <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">My Requests</h1>
      <p className="text-xs text-muted-foreground mt-0.5">All your requests in one place</p>
    </div>

    <div className="flex gap-2 overflow-x-auto pb-2">
      {['All', 'Leave', 'Parcel', 'Medical', 'Maintenance', 'Guest', 'Housekeeping', 'Suggestion', 'Missing Report'].map(f => (
        <button key={f} className={`rounded-full text-xs font-medium px-3 py-1.5 whitespace-nowrap shadow-card transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-primary hover:text-primary-foreground'}`} onClick={() => setFilter(f)}>
          {f}
        </button>
      ))}
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading request history...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {rows.map((r, i) => (
        <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl ${r.color} p-2.5`}>
                <r.icon className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.type} • {new Date(r.date).toLocaleDateString()}</p>
              </div>
            </div>
            <Badge className={`rounded-full text-[10px] ${statusColors[r.status]}`}>{r.status}</Badge>
          </div>
        </motion.div>
      ))}
      {!isLoading && rows.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No requests found.</div> : null}
    </div>
  </div>
  );
};

export default RequestHistoryPage;
