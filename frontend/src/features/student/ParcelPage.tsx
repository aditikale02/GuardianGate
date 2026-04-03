import { motion } from 'framer-motion';
import { Package, Clock, CheckCircle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type ParcelsResponse = {
  rows: Array<{
    id: string;
    description: string;
    sender_name: string | null;
    status: string;
    received_at: string;
    collected_at: string | null;
    warden_remark: string | null;
  }>;
};

const statusColors: Record<string, string> = {
  RECEIVED: 'bg-peach text-peach-foreground',
  PICKUP_REQUESTED: 'bg-lavender text-lavender-foreground',
  NOTIFIED: 'bg-mint text-mint-foreground',
  COLLECTED: 'bg-muted text-muted-foreground',
};

const ParcelPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [courier, setCourier] = useState('');
  const [details, setDetails] = useState('');
  const [remark, setRemark] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-parcels'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/parcels/my');
      return parseJsonOrThrow<ParcelsResponse>(response, 'Failed to load parcels');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/workflows/parcels', {
        method: 'POST',
        body: JSON.stringify({
          sender_name: courier || undefined,
          description: details,
          warden_remark: remark || undefined,
        }),
      });
      await parseJsonOrThrow(response, 'Failed to submit parcel request');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-parcels'] });
      setShowForm(false);
      setCourier('');
      setDetails('');
      setRemark('');
    },
  });

  const parcels = data?.rows || [];

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Parcels</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track & collect your parcels</p>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Request
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Request Parcel Pickup</h3>
          <Input placeholder="Courier / Source" className="rounded-xl" value={courier} onChange={(e) => setCourier(e.target.value)} />
          <Input placeholder="Parcel details" className="rounded-xl" value={details} onChange={(e) => setDetails(e.target.value)} />
          <Input placeholder="Preferred pickup time" className="rounded-xl" />
          <Input placeholder="Remarks (optional)" className="rounded-xl" value={remark} onChange={(e) => setRemark(e.target.value)} />
          <Button
            className="w-full rounded-xl"
            onClick={() => createMutation.mutate()}
            disabled={!details || createMutation.isPending}
          >
            {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Button>
        </motion.div>
      )}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading parcels...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="space-y-3">
        {parcels.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-peach p-2.5">
                  <Package className="h-5 w-5 text-peach-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.description}</p>
                  <p className="text-xs text-muted-foreground">{p.sender_name || 'Unknown sender'} • {new Date(p.received_at).toLocaleDateString()}</p>
                </div>
              </div>
              <Badge className={`rounded-full text-[10px] ${statusColors[p.status] || 'bg-lavender text-lavender-foreground'}`}>
                {p.status.toLowerCase()}
              </Badge>
            </div>
            {p.collected_at && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Collected: {new Date(p.collected_at).toLocaleString()}
              </div>
            )}
            {p.warden_remark ? <p className="mt-1 text-xs text-muted-foreground">Remark: {p.warden_remark}</p> : null}
          </motion.div>
        ))}
        {!isLoading && parcels.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No parcel records yet.</div> : null}
      </div>
    </div>
  );
};

export default ParcelPage;
