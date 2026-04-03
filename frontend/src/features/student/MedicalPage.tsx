import { motion } from 'framer-motion';
import { Stethoscope, Plus, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type MedicalResponse = {
  rows: Array<{
    id: string;
    symptoms: string;
    urgency: string;
    status: string;
    doctor_notes: string | null;
    created_at: string;
  }>;
};

const urgencyColors: Record<string, string> = { NORMAL: 'bg-mint text-mint-foreground', URGENT: 'bg-peach text-peach-foreground', EMERGENCY: 'bg-destructive/15 text-destructive' };
const statusColors: Record<string, string> = { OPEN: 'bg-peach text-peach-foreground', ASSIGNED: 'bg-lavender text-lavender-foreground', ESCALATED: 'bg-blush text-blush-foreground', RESOLVED: 'bg-mint text-mint-foreground' };

const MedicalPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [urgency, setUrgency] = useState('NORMAL');

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-medical'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/medical/my');
      return parseJsonOrThrow<MedicalResponse>(response, 'Failed to load medical requests');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/workflows/medical', {
        method: 'POST',
        body: JSON.stringify({
          symptoms,
          urgency,
        }),
      });
      await parseJsonOrThrow(response, 'Failed to submit medical request');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-medical'] });
      setShowForm(false);
      setSymptoms('');
      setUrgency('NORMAL');
    },
  });

  const requests = data?.rows || [];

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Medical Help</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Request medical assistance</p>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Request
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Request Medical Help</h3>
          <Input placeholder="Describe symptoms" className="rounded-xl" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
          <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="">Urgency level</option>
            <option value="NORMAL">Low</option>
            <option value="URGENT">Medium</option>
            <option value="EMERGENCY">High — Need immediate help</option>
          </select>
          <Input placeholder="Preferred time" className="rounded-xl" />
          <Input placeholder="Additional notes (optional)" className="rounded-xl" />
          <Button className="w-full rounded-xl" onClick={() => createMutation.mutate()} disabled={!symptoms || createMutation.isPending}>
            {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Button>
        </motion.div>
      )}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading medical requests...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="space-y-3">
        {requests.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-mint p-2.5">
                  <Stethoscope className="h-5 w-5 text-mint-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.symptoms}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={`rounded-full text-[10px] ${urgencyColors[r.urgency] || 'bg-peach text-peach-foreground'}`}>{r.urgency.toLowerCase()}</Badge>
                <Badge className={`rounded-full text-[10px] ${statusColors[r.status] || 'bg-lavender text-lavender-foreground'}`}>{r.status.toLowerCase()}</Badge>
              </div>
            </div>
            {r.doctor_notes ? <p className="mt-2 text-xs text-muted-foreground">Doctor notes: {r.doctor_notes}</p> : null}
          </motion.div>
        ))}
        {!isLoading && requests.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No medical requests yet.</div> : null}
      </div>
    </div>
  );
};

export default MedicalPage;
