import { motion } from 'framer-motion';
import { Wrench, Plus, Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type MaintenanceResponse = {
  rows?: Array<{
    id: string;
    type?: string;
    room?: string;
    priority?: string;
    status?: string;
    date?: string;
    description?: string;
  }>;
  items?: Array<{
    id: string;
    type?: string;
    room?: string;
    priority?: string;
    status?: string;
    date?: string;
    description?: string;
  }>;
  notice?: string;
};

const issueTypes = ['Fan issue', 'Light not working', 'Plumbing issue', 'Bed damage', 'Electrical issue', 'Wi-Fi issue', 'Other'];
const statusColors: Record<string, string> = { submitted: 'bg-peach text-peach-foreground', 'in progress': 'bg-lavender text-lavender-foreground', completed: 'bg-mint text-mint-foreground' };
const priorityColors: Record<string, string> = { low: 'bg-mint text-mint-foreground', medium: 'bg-peach text-peach-foreground', high: 'bg-destructive/15 text-destructive' };

const MaintenancePage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-maintenance'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/maintenance/my');
      return parseJsonOrThrow<MaintenanceResponse>(response, 'Failed to load maintenance requests');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/campus/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          issue_type: issueType || undefined,
          room_number: roomNumber || undefined,
          description,
          priority,
        }),
      });
      await parseJsonOrThrow(response, 'Failed to submit maintenance request');
    },
    onSuccess: () => {
      setShowForm(false);
      setIssueType('');
      setRoomNumber('');
      setDescription('');
      setPriority('medium');
      queryClient.invalidateQueries({ queryKey: ['student-maintenance'] });
    },
  });

  const issues = data?.rows || data?.items || [];

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Maintenance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Report room issues</p>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Report
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Report Issue</h3>
          <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
            <option value="">Issue type</option>
            {issueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input placeholder="Room number" className="rounded-xl" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
          <textarea placeholder="Describe the issue..." className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
          <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Camera className="h-4 w-4" /> Attach photo (optional)
          </button>
          <Button className="w-full rounded-xl" disabled={!description || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? 'Submitting...' : 'Submit Report'}</Button>
        </motion.div>
      )}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading maintenance requests...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}
      {createMutation.isError ? (
        <div className="rounded-2xl bg-card p-4 text-sm text-destructive">
          {(createMutation.error as Error).message || 'Failed to submit maintenance request'}
        </div>
      ) : null}
      {!error && data?.notice ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">{data.notice}</div> : null}

      <div className="space-y-3">
        {issues.map((issue, i) => (
          <motion.div key={issue.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-peach p-2.5">
                  <Wrench className="h-5 w-5 text-peach-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{issue.description || 'Maintenance request'}</p>
                  <p className="text-xs text-muted-foreground">Room {issue.room || 'N/A'} • {issue.date ? new Date(issue.date).toLocaleDateString() : 'Unknown date'}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className="rounded-full text-[10px] bg-muted text-muted-foreground">{(issue.type || 'other').toLowerCase()}</Badge>
                <Badge className={`rounded-full text-[10px] ${priorityColors[(issue.priority || 'medium').toLowerCase()] || priorityColors.medium}`}>{(issue.priority || 'medium').toLowerCase()}</Badge>
                <Badge className={`rounded-full text-[10px] ${statusColors[(issue.status || 'submitted').toLowerCase()] || statusColors.submitted}`}>{(issue.status || 'submitted').toLowerCase()}</Badge>
              </div>
            </div>
          </motion.div>
        ))}
        {!isLoading && issues.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No maintenance requests yet.</div> : null}
      </div>
    </div>
  );
};

export default MaintenancePage;
