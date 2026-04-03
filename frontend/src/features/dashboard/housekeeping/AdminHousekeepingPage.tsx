import { Sparkles, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type HousekeepingResponse = {
  rows: Array<{
    id: string;
    room: string;
    student: string;
    issue: string;
    category: string;
    status: string;
    raw_status: 'PENDING' | 'IN_PROGRESS' | 'AWAITING_PARTS' | 'RESOLVED';
    date: string;
  }>;
};

const AdminHousekeepingPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-housekeeping'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/housekeeping');
      return parseJsonOrThrow<HousekeepingResponse>(response, 'Failed to load housekeeping requests');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'IN_PROGRESS' | 'RESOLVED' }) => {
      const response = await authenticatedFetch(`/campus/housekeeping/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await parseJsonOrThrow(response, 'Failed to update housekeeping status');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-housekeeping'] }),
  });

  const issues = useMemo(() => {
    const rows = data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.student.toLowerCase().includes(q) ||
      row.room.toLowerCase().includes(q) ||
      row.issue.toLowerCase().includes(q) ||
      row.category.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
  <div className="space-y-6 max-w-4xl">
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">Housekeeping</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage cleaning schedules and complaints</p>
    </div>

    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 max-w-md">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input placeholder="Search..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading housekeeping requests...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {issues.map((h, i) => (
        <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-4 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lavender p-2.5"><Sparkles className="h-5 w-5 text-lavender-foreground" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">{h.issue}</p>
              <p className="text-xs text-muted-foreground">Room {h.room} • {h.student} • {new Date(h.date).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge className="rounded-full text-[10px] bg-muted text-muted-foreground">{h.category.toLowerCase()}</Badge>
            <Badge className={`rounded-full text-[10px] ${h.status === 'completed' ? 'bg-mint text-mint-foreground' : h.status === 'in progress' ? 'bg-lavender text-lavender-foreground' : 'bg-peach text-peach-foreground'}`}>{h.status}</Badge>
            {h.raw_status === 'PENDING' ? <button className="rounded-lg bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5" onClick={() => updateMutation.mutate({ id: h.id, status: 'IN_PROGRESS' })}>Start</button> : null}
            {h.raw_status === 'IN_PROGRESS' || h.raw_status === 'AWAITING_PARTS' ? <button className="rounded-lg bg-mint text-mint-foreground text-xs font-semibold px-3 py-1.5" onClick={() => updateMutation.mutate({ id: h.id, status: 'RESOLVED' })}>Resolve</button> : null}
          </div>
        </motion.div>
      ))}
      {!isLoading && issues.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No housekeeping requests found.</div> : null}
    </div>
  </div>
  );
};

export default AdminHousekeepingPage;
