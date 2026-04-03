import { motion } from 'framer-motion';
import { Search, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type LeaveResponse = {
  rows: Array<{
    id: string;
    student: string;
    room: string;
    departure_at: string;
    return_at: string;
    reason: string;
    destination: string;
    status: string;
    warden_remark: string | null;
  }>;
};

const statusColors: Record<string, string> = { PENDING: 'bg-peach text-peach-foreground', APPROVED: 'bg-mint text-mint-foreground', REJECTED: 'bg-destructive/15 text-destructive' };

const AdminLeaveRequestsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-leave-requests'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/night-leave');
      return parseJsonOrThrow<LeaveResponse>(response, 'Failed to load leave requests');
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const response = await authenticatedFetch(`/workflows/night-leave/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await parseJsonOrThrow(response, 'Failed to update leave request');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-leave-requests'] }),
  });

  const leaveRequests = useMemo(() => {
    const rows = data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.student.toLowerCase().includes(q) || row.room.toLowerCase().includes(q));
  }, [data, search]);

  return (
  <div className="space-y-6 max-w-4xl">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Leave Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Approve or reject student leave applications</p>
      </div>
      <Badge className="bg-peach text-peach-foreground rounded-full">{leaveRequests.filter(l => l.status === 'PENDING').length} pending</Badge>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading leave requests...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="flex gap-2">
      <div className="flex-1 flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input placeholder="Search students..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
    </div>

    <div className="space-y-3">
      {leaveRequests.map((l, i) => (
        <motion.div key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-5 shadow-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">{l.student}</h3>
              <p className="text-xs text-muted-foreground">Room {l.room} • {l.id}</p>
            </div>
            <Badge className={`rounded-full text-xs ${statusColors[l.status] || 'bg-lavender text-lavender-foreground'}`}>{l.status.toLowerCase()}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
            <div><span className="font-medium text-foreground">From:</span> {new Date(l.departure_at).toLocaleString()}</div>
            <div><span className="font-medium text-foreground">To:</span> {new Date(l.return_at).toLocaleString()}</div>
            <div><span className="font-medium text-foreground">Reason:</span> {l.reason}</div>
            <div><span className="font-medium text-foreground">Destination:</span> {l.destination}</div>
            {l.warden_remark ? <div className="col-span-2"><span className="font-medium text-foreground">Remark:</span> {l.warden_remark}</div> : null}
          </div>
          {l.status === 'PENDING' && (
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-mint text-mint-foreground text-sm font-semibold py-2 flex items-center justify-center gap-1" onClick={() => decisionMutation.mutate({ id: l.id, action: 'approve' })}>
                <CheckCircle className="h-4 w-4" /> Approve
              </button>
              <button className="flex-1 rounded-xl bg-destructive/15 text-destructive text-sm font-semibold py-2 flex items-center justify-center gap-1" onClick={() => decisionMutation.mutate({ id: l.id, action: 'reject' })}>
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          )}
        </motion.div>
      ))}
      {!isLoading && leaveRequests.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No leave requests found.</div> : null}
    </div>
  </div>
  );
};

export default AdminLeaveRequestsPage;
