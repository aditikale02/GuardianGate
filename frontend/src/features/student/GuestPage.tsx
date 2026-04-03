import { motion } from 'framer-motion';
import { Users, Plus, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type GuestResponse = {
  rows: Array<{
    id: string;
    guest_name: string;
    relationship: string;
    guest_phone: string | null;
    purpose: string | null;
    expected_visit_at: string;
    expected_duration: number;
    status: string;
    checked_in_at: string | null;
    checked_out_at: string | null;
  }>;
};

const GuestPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-guests'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/guests/my');
      return parseJsonOrThrow<GuestResponse>(response, 'Failed to load guest requests');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const expectedVisitAt = new Date(`${date}T${time || '12:00'}:00`);
      const response = await authenticatedFetch('/workflows/guests', {
        method: 'POST',
        body: JSON.stringify({
          guest_name: guestName,
          relationship: relation,
          guest_phone: phone || undefined,
          purpose: purpose || undefined,
          expected_visit_at: expectedVisitAt.toISOString(),
          expected_duration: 180,
        }),
      });
      await parseJsonOrThrow(response, 'Failed to submit guest request');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-guests'] });
      setShowForm(false);
      setGuestName('');
      setRelation('');
      setPhone('');
      setPurpose('');
      setDate('');
      setTime('');
    },
  });

  const guests = data?.rows || [];

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Guest Registration</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Register visitors for hostel entry</p>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Register
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Register Guest</h3>
          <Input placeholder="Guest name" className="rounded-xl" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <Input placeholder="Relation" className="rounded-xl" value={relation} onChange={(e) => setRelation(e.target.value)} />
          <Input placeholder="Phone number" className="rounded-xl" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Purpose of visit" className="rounded-xl" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" className="rounded-xl" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input type="time" className="rounded-xl" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={() => createMutation.mutate()}
            disabled={!guestName || !relation || !date || createMutation.isPending}
          >
            {createMutation.isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </motion.div>
      )}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading guest requests...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="space-y-3">
        {guests.map((g, i) => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-mint p-2.5">
                  <Users className="h-5 w-5 text-mint-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{g.guest_name}</p>
                  <p className="text-xs text-muted-foreground">{g.relationship} • {g.guest_phone || '--'}</p>
                </div>
              </div>
              <Badge className={`rounded-full text-[10px] ${g.status === 'APPROVED' ? 'bg-mint text-mint-foreground' : g.status === 'REJECTED' ? 'bg-destructive/15 text-destructive' : 'bg-peach text-peach-foreground'}`}>
                {g.status.toLowerCase()}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{new Date(g.expected_visit_at).toLocaleDateString()}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(g.expected_visit_at).toLocaleTimeString()} → {g.expected_duration} mins</span>
            </div>
          </motion.div>
        ))}
        {!isLoading && guests.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No guest requests yet.</div> : null}
      </div>
    </div>
  );
};

export default GuestPage;
