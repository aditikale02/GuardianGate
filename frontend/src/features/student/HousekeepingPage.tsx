import { motion } from 'framer-motion';
import { Sparkles, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

const schedule = [
  { day: 'Monday', time: '9:00 AM', status: 'completed' },
  { day: 'Wednesday', time: '9:00 AM', status: 'scheduled' },
  { day: 'Friday', time: '9:00 AM', status: 'scheduled' },
];

type HousekeepingResponse = {
  rows: Array<{
    id: string;
    issue: string;
    date: string;
    status: string;
    category: string;
  }>;
};

const statusColors: Record<string, string> = {
  completed: 'bg-mint text-mint-foreground',
  scheduled: 'bg-lavender text-lavender-foreground',
  'in progress': 'bg-peach text-peach-foreground',
  resolved: 'bg-mint text-mint-foreground',
};

const HousekeepingPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [complaint, setComplaint] = useState('');
  const [category, setCategory] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-housekeeping'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/housekeeping/my');
      return parseJsonOrThrow<HousekeepingResponse>(response, 'Failed to load housekeeping complaints');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/campus/housekeeping', {
        method: 'POST',
        body: JSON.stringify({
          description: complaint,
          category: category || undefined,
        }),
      });
      await parseJsonOrThrow(response, 'Failed to submit complaint');
    },
    onSuccess: () => {
      setShowForm(false);
      setComplaint('');
      setCategory('');
      queryClient.invalidateQueries({ queryKey: ['student-housekeeping'] });
    },
  });

  const complaints = data?.rows || [];

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Housekeeping</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Cleaning schedule & complaints</p>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Complaint
        </Button>
      </div>

      {/* Cleaning Schedule */}
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <h3 className="font-display font-semibold text-sm text-foreground mb-3">Cleaning Schedule</h3>
        <div className="space-y-2">
          {schedule.map(s => (
            <div key={s.day} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{s.day}</span>
                <span className="text-xs text-muted-foreground">{s.time}</span>
              </div>
              <Badge className={`rounded-full text-[10px] ${statusColors[s.status]}`}>{s.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Raise Complaint</h3>
          <input placeholder="Category (optional)" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)} />
          <textarea placeholder="Describe the housekeeping issue..." className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none" value={complaint} onChange={(e) => setComplaint(e.target.value)} />
          <Button className="w-full rounded-xl" disabled={!complaint || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? 'Submitting...' : 'Submit Complaint'}</Button>
        </motion.div>
      )}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading complaints...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      {/* Complaints */}
      <div className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-foreground">Recent Complaints</h3>
        {complaints.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-lavender p-2.5">
                  <Sparkles className="h-5 w-5 text-lavender-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.issue}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge className="rounded-full text-[10px] bg-muted text-muted-foreground">{c.category.toLowerCase()}</Badge>
                <Badge className={`rounded-full text-[10px] ${statusColors[c.status]}`}>{c.status}</Badge>
              </div>
            </div>
          </motion.div>
        ))}
        {!isLoading && complaints.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No complaints yet.</div> : null}
      </div>
    </div>
  );
};

export default HousekeepingPage;
