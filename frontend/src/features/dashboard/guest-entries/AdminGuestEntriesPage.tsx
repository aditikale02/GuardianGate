import { motion } from 'framer-motion';
import { Search, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type GuestsResponse = {
  rows: Array<{
    id: string;
    student: string;
    room: string;
    guest_name: string;
    relationship: string;
    guest_phone: string | null;
    purpose: string | null;
    expected_visit_at: string;
    status: string;
  }>;
};

const AdminGuestEntriesPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-guests'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/guests');
      return parseJsonOrThrow<GuestsResponse>(response, 'Failed to load guest entries');
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const response = await authenticatedFetch(`/workflows/guests/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await parseJsonOrThrow(response, 'Failed to update guest entry');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-guests'] }),
  });

  const guests = useMemo(() => {
    const rows = data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.student.toLowerCase().includes(q) ||
      row.guest_name.toLowerCase().includes(q) ||
      row.room.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
  <div className="space-y-6 max-w-4xl">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Guest Entries</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage visitor registrations</p>
      </div>
    </div>

    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 max-w-md">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input placeholder="Search guests..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading guest entries...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {guests.map((g, i) => (
        <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-5 shadow-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">{g.guest_name} <span className="text-xs text-muted-foreground">({g.relationship})</span></h3>
              <p className="text-xs text-muted-foreground">Visiting {g.student} • Room {g.room}</p>
            </div>
            <Badge className={`rounded-full text-xs ${g.status === 'APPROVED' ? 'bg-mint text-mint-foreground' : g.status === 'REJECTED' ? 'bg-destructive/15 text-destructive' : 'bg-peach text-peach-foreground'}`}>{g.status.toLowerCase()}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
            <div><span className="font-medium text-foreground">Date:</span> {new Date(g.expected_visit_at).toLocaleDateString()}</div>
            <div><span className="font-medium text-foreground">Time:</span> {new Date(g.expected_visit_at).toLocaleTimeString()}</div>
            <div><span className="font-medium text-foreground">Phone:</span> {g.guest_phone || '--'}</div>
            <div><span className="font-medium text-foreground">Purpose:</span> {g.purpose}</div>
          </div>
          {g.status === 'PENDING' && (
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-mint text-mint-foreground text-sm font-semibold py-2 flex items-center justify-center gap-1" onClick={() => decisionMutation.mutate({ id: g.id, action: 'approve' })}>
                <CheckCircle className="h-4 w-4" /> Approve
              </button>
              <button className="flex-1 rounded-xl bg-destructive/15 text-destructive text-sm font-semibold py-2 flex items-center justify-center gap-1" onClick={() => decisionMutation.mutate({ id: g.id, action: 'reject' })}>
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          )}
        </motion.div>
      ))}
      {!isLoading && guests.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No guest entries found.</div> : null}
    </div>
  </div>
  );
};

export default AdminGuestEntriesPage;
