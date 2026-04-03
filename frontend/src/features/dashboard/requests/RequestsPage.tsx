import { Inbox, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type RequestsResponse = {
  summary: {
    pending: number;
    approved: number;
    rejected: number;
  };
  rows: Array<{
    id: string;
    student: string;
    type: string;
    submitted_at: string;
    status: string;
  }>;
};

const statusStyles: Record<string, string> = {
  PENDING: 'bg-peach text-peach-foreground',
  APPROVED: 'bg-mint text-mint-foreground',
  REJECTED: 'bg-blush text-blush-foreground',
  CANCELLED: 'bg-lavender text-lavender-foreground',
};

const RequestsPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/requests');
      return parseJsonOrThrow<RequestsResponse>(response, 'Failed to load requests');
    },
  });

  const requests = data?.rows || [];

  return (
  <div className="max-w-4xl space-y-6">
    <h1 className="font-display text-2xl font-bold text-foreground">Requests</h1>
    <p className="text-sm text-muted-foreground">Manage student requests and approvals</p>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading requests...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-4">
      {requests.map((r, i) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-2xl bg-card shadow-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground text-sm">{r.type}</h3>
              <Badge className={`rounded-full text-xs ${statusStyles[r.status] || 'bg-lavender text-lavender-foreground'}`}>{r.status.toLowerCase()}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{r.student}</p>
            <p className="text-xs text-muted-foreground mt-1">Submitted: {new Date(r.submitted_at).toLocaleString()}</p>
          </div>
          {r.status === 'PENDING' && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" className="rounded-xl gap-1" disabled title="Action endpoint will be added in workflow phase"><Check className="h-3 w-3" /> Approve</Button>
              <Button size="sm" variant="outline" className="rounded-xl gap-1" disabled title="Action endpoint will be added in workflow phase"><X className="h-3 w-3" /> Reject</Button>
            </div>
          )}
        </motion.div>
      ))}
      {!isLoading && requests.length === 0 ? (
        <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No requests found.</div>
      ) : null}
    </div>
  </div>
  );
};

export default RequestsPage;
