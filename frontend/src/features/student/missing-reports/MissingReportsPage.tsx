import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type MissingReportRow = {
  id: string;
  title: string;
  description: string;
  location?: string | null;
  last_seen_at?: string | null;
  image_url?: string | null;
  status: 'OPEN' | 'IN_REVIEW' | 'FOUND' | 'CLOSED';
  resolution_notes?: string | null;
  reviewed_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
};

type MissingReportResponse = {
  rows: MissingReportRow[];
};

const statusClass: Record<MissingReportRow['status'], string> = {
  OPEN: 'bg-peach text-peach-foreground',
  IN_REVIEW: 'bg-lavender text-lavender-foreground',
  FOUND: 'bg-mint text-mint-foreground',
  CLOSED: 'bg-muted text-muted-foreground',
};

const MissingReportsPage = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [lastSeenAt, setLastSeenAt] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const reportsQuery = useQuery({
    queryKey: ['student-missing-reports'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/missing-reports/my');
      return parseJsonOrThrow<MissingReportResponse>(response, 'Failed to load missing reports');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/workflows/missing-reports', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          location: location || undefined,
          last_seen_at: lastSeenAt ? new Date(lastSeenAt).toISOString() : undefined,
          image_url: imageUrl || undefined,
        }),
      });
      return parseJsonOrThrow<{ id: string }>(response, 'Failed to submit missing report');
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setLocation('');
      setLastSeenAt('');
      setImageUrl('');
      queryClient.invalidateQueries({ queryKey: ['student-missing-reports'] });
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const rows = reportsQuery.data?.rows || [];

  return (
    <div className="space-y-5 max-w-3xl mx-auto px-4 py-5">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">Missing Reports</h1>
        <p className="text-xs text-muted-foreground mt-1">Report missing items and track status updates.</p>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl bg-card p-4 shadow-card space-y-3">
        <Input placeholder="Item title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <textarea
          placeholder="Describe the item and any unique identifiers"
          className="min-h-[90px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Last seen location (optional)" value={location} onChange={(event) => setLocation(event.target.value)} />
          <Input type="datetime-local" value={lastSeenAt} onChange={(event) => setLastSeenAt(event.target.value)} />
        </div>
        <Input placeholder="Image URL (optional)" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
        <Button className="rounded-xl" type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Submitting...' : 'Submit Missing Report'}
        </Button>
      </form>

      {reportsQuery.isLoading ? <div className="text-sm text-muted-foreground">Loading reports...</div> : null}
      {reportsQuery.error ? <div className="text-sm text-destructive">{(reportsQuery.error as Error).message}</div> : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground text-sm">{row.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{row.description}</p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Created: {new Date(row.created_at).toLocaleString()}
                  {row.location ? ` • Location: ${row.location}` : ''}
                </p>
                {row.resolution_notes ? <p className="text-xs text-muted-foreground mt-2">Notes: {row.resolution_notes}</p> : null}
              </div>
              <Badge className={`rounded-full text-[10px] ${statusClass[row.status]}`}>{row.status}</Badge>
            </div>
          </div>
        ))}
        {!reportsQuery.isLoading && rows.length === 0 ? (
          <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No missing reports submitted yet.</div>
        ) : null}
      </div>
    </div>
  );
};

export default MissingReportsPage;
