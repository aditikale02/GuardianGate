import { motion } from 'framer-motion';
import { Package, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type ParcelsResponse = {
  rows: Array<{
    id: string;
    student: string;
    room: string;
    courier: string;
    description: string;
    status: string;
    created_at: string;
  }>;
};

const statusColors: Record<string, string> = {
  RECEIVED: 'bg-lavender text-lavender-foreground',
  NOTIFIED: 'bg-mint text-mint-foreground',
  PICKUP_REQUESTED: 'bg-peach text-peach-foreground',
  COLLECTED: 'bg-muted text-muted-foreground',
};

const AdminParcelsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-parcels'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/parcels');
      return parseJsonOrThrow<ParcelsResponse>(response, 'Failed to load parcels');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'NOTIFIED' | 'COLLECTED' }) => {
      const response = await authenticatedFetch(`/workflows/parcels/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await parseJsonOrThrow(response, 'Failed to update parcel status');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-parcels'] }),
  });

  const parcels = useMemo(() => {
    const rows = data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.student.toLowerCase().includes(q) ||
      row.room.toLowerCase().includes(q) ||
      row.courier.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
  <div className="space-y-6 max-w-4xl">
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">Parcel Management</h1>
      <p className="text-sm text-muted-foreground mt-1">Track and manage student parcels</p>
    </div>

    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 max-w-md">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input placeholder="Search parcels..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading parcels...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {parcels.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-4 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-peach p-2.5">
              <Package className="h-5 w-5 text-peach-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{p.student} <span className="text-xs text-muted-foreground">Room {p.room}</span></p>
              <p className="text-xs text-muted-foreground">{p.courier} • {p.description} • {new Date(p.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`rounded-full text-[10px] ${statusColors[p.status] || 'bg-muted text-muted-foreground'}`}>{p.status.toLowerCase()}</Badge>
            {p.status === 'PICKUP_REQUESTED' && <button className="rounded-lg bg-mint text-mint-foreground text-xs font-semibold px-3 py-1.5" onClick={() => updateMutation.mutate({ id: p.id, status: 'NOTIFIED' })}>Mark Ready</button>}
            {p.status === 'NOTIFIED' && <button className="rounded-lg bg-muted text-foreground text-xs font-semibold px-3 py-1.5" onClick={() => updateMutation.mutate({ id: p.id, status: 'COLLECTED' })}>Mark Collected</button>}
          </div>
        </motion.div>
      ))}
      {!isLoading && parcels.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No parcels found.</div> : null}
    </div>
  </div>
  );
};

export default AdminParcelsPage;
