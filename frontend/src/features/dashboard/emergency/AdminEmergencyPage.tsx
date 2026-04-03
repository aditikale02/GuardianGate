import { Plus, AlertTriangle, Zap, Droplets } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type EmergencyResponse = {
  rows: Array<{
    id: string;
    title: string;
    message: string;
    priority: string;
    age: string;
    active: boolean;
  }>;
};

const AdminEmergencyPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['campus-emergency-admin'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/emergency');
      return parseJsonOrThrow<EmergencyResponse>(response, 'Failed to load emergency alerts');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/campus/emergency', {
        method: 'POST',
        body: JSON.stringify({
          title,
          message,
          priority: 'HIGH',
        }),
      });
      await parseJsonOrThrow(response, 'Failed to publish emergency alert');
    },
    onSuccess: () => {
      setShowForm(false);
      setTitle('');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['campus-emergency-admin'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await authenticatedFetch(`/campus/emergency/${id}/resolve`, { method: 'POST' });
      await parseJsonOrThrow(response, 'Failed to resolve alert');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campus-emergency-admin'] }),
  });

  const alerts = data?.rows || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Emergency Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">Publish urgent notifications for students</p>
        </div>
        <Button className="rounded-xl bg-destructive hover:bg-destructive/90" onClick={() => setShowForm(!showForm)}>
          <AlertTriangle className="h-4 w-4 mr-1" /> New Alert
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-destructive/5 border border-destructive/20 p-5 space-y-3">
          <Input placeholder="Alert title" className="rounded-xl" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea placeholder="Describe the emergency..." className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none" value={message} onChange={(e) => setMessage(e.target.value)} />
          <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
            <option value="">Affected area</option>
            <option>All Blocks</option><option>Block A</option><option>Block B</option><option>Block C</option>
          </select>
          <Button className="w-full rounded-xl bg-destructive hover:bg-destructive/90" onClick={() => createMutation.mutate()} disabled={!title || !message || createMutation.isPending}>{createMutation.isPending ? 'Publishing...' : 'Publish Emergency Alert'}</Button>
        </motion.div>
      )}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading emergency alerts...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="space-y-3">
        {alerts.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={`rounded-2xl p-4 shadow-card ${a.active ? 'bg-destructive/10 border border-destructive/20' : 'bg-card'}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  {a.active && <AlertTriangle className="h-4 w-4 text-destructive" />} {a.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{a.age}</p>
              </div>
              <div className="flex gap-2">
                {a.active && <Badge className="bg-destructive/15 text-destructive rounded-full text-[10px]">Active</Badge>}
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => a.active && resolveMutation.mutate(a.id)}>{a.active ? 'Resolve' : 'Resolved'}</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminEmergencyPage;
