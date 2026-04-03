import { motion } from 'framer-motion';
import { Moon, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type NightLeaveResponse = {
  rows: Array<{
    id: string;
    departure_at: string;
    return_at: string;
    reason: string;
    destination: string;
    status: string;
    warden_remark: string | null;
  }>;
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-peach text-peach-foreground',
  APPROVED: 'bg-mint text-mint-foreground',
  REJECTED: 'bg-destructive/15 text-destructive',
  CANCELLED: 'bg-lavender text-lavender-foreground',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const NightLeavePage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-night-leave'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/night-leave/my');
      return parseJsonOrThrow<NightLeaveResponse>(response, 'Failed to load leave requests');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/workflows/night-leave', {
        method: 'POST',
        body: JSON.stringify({
          departure_at: new Date(fromDate).toISOString(),
          return_at: new Date(toDate).toISOString(),
          reason,
          destination,
        }),
      });
      await parseJsonOrThrow(response, 'Failed to submit leave request');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-night-leave'] });
      setShowForm(false);
      setFromDate('');
      setToDate('');
      setReason('');
      setDestination('');
      setFormError(null);
    },
    onError: (error: unknown) => {
      setFormError(getErrorMessage(error, 'Unable to submit request'));
    },
  });

  const leaves = data?.rows || [];

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Night Leave</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Apply & track leave requests</p>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Apply
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Apply for Night Leave</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input type="datetime-local" placeholder="From" className="rounded-xl" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="datetime-local" placeholder="To" className="rounded-xl" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <Input placeholder="Reason" className="rounded-xl" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Input placeholder="Destination" className="rounded-xl" value={destination} onChange={(e) => setDestination(e.target.value)} />
          <Input placeholder="Parent/Guardian contact" className="rounded-xl" />
          {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
          <Button
            className="w-full rounded-xl"
            onClick={() => createMutation.mutate()}
            disabled={!fromDate || !toDate || !reason || !destination || createMutation.isPending}
          >
            {createMutation.isPending ? 'Submitting...' : 'Submit Application'}
          </Button>
        </motion.div>
      )}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading leave requests...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="space-y-3">
        {leaves.map((l, i) => (
          <motion.div
            key={l.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blush p-2.5">
                  <Moon className="h-5 w-5 text-blush-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{l.reason}</p>
                  <p className="text-xs text-muted-foreground">{l.destination}</p>
                </div>
              </div>
              <Badge className={`rounded-full text-[10px] ${statusColors[l.status] || 'bg-lavender text-lavender-foreground'}`}>
                {l.status.toLowerCase()}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {new Date(l.departure_at).toLocaleString()} → {new Date(l.return_at).toLocaleString()}
            </div>
            {l.warden_remark ? <p className="mt-1 text-xs text-muted-foreground">Remark: {l.warden_remark}</p> : null}
          </motion.div>
        ))}
        {!isLoading && leaves.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No leave requests yet.</div> : null}
      </div>
    </div>
  );
};

export default NightLeavePage;
