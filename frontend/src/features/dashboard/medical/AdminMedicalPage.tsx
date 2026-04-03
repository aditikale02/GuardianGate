import { Stethoscope, Search, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type MedicalResponse = {
  rows: Array<{
    id: string;
    student: string;
    room: string;
    symptoms: string;
    urgency: string;
    status: string;
    created_at: string;
  }>;
};

const AdminMedicalPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-medical'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/medical');
      return parseJsonOrThrow<MedicalResponse>(response, 'Failed to load medical requests');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ASSIGNED' | 'RESOLVED' }) => {
      const response = await authenticatedFetch(`/workflows/medical/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await parseJsonOrThrow(response, 'Failed to update medical request');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-medical'] }),
  });

  const requests = useMemo(() => {
    const rows = data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.student.toLowerCase().includes(q) ||
      row.room.toLowerCase().includes(q) ||
      row.symptoms.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
  <div className="space-y-6 max-w-4xl">
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">Medical Requests</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage student medical assistance requests</p>
    </div>

    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 max-w-md">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input placeholder="Search..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading medical requests...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {requests.map((r, i) => (
        <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-5 shadow-card">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-foreground">{r.student} <span className="text-xs text-muted-foreground">Room {r.room}</span></h3>
              <p className="text-xs text-muted-foreground">{r.symptoms} • {new Date(r.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-1">
              <Badge className={`rounded-full text-[10px] ${r.urgency === 'HIGH' ? 'bg-destructive/15 text-destructive' : r.urgency === 'MEDIUM' ? 'bg-peach text-peach-foreground' : 'bg-mint text-mint-foreground'}`}>{r.urgency.toLowerCase()}</Badge>
              <Badge className={`rounded-full text-[10px] ${r.status === 'RESOLVED' ? 'bg-mint text-mint-foreground' : r.status === 'ASSIGNED' ? 'bg-lavender text-lavender-foreground' : 'bg-peach text-peach-foreground'}`}>{r.status.toLowerCase()}</Badge>
            </div>
          </div>
          {r.status === 'SUBMITTED' && (
            <button className="rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 mt-2" onClick={() => statusMutation.mutate({ id: r.id, status: 'ASSIGNED' })}>
              <CheckCircle className="h-4 w-4 inline mr-1" /> Assign Doctor
            </button>
          )}
          {r.status === 'ASSIGNED' && (
            <button className="rounded-xl bg-mint text-mint-foreground text-sm font-semibold px-4 py-2 mt-2" onClick={() => statusMutation.mutate({ id: r.id, status: 'RESOLVED' })}>
              <CheckCircle className="h-4 w-4 inline mr-1" /> Mark Completed
            </button>
          )}
        </motion.div>
      ))}
      {!isLoading && requests.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No medical requests found.</div> : null}
    </div>
  </div>
  );
};

export default AdminMedicalPage;
