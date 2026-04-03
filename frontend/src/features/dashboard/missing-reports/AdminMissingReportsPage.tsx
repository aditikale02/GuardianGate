import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type AdminMissingReportRow = {
  id: string;
  student: string;
  hostel_id: string;
  room: string;
  title: string;
  description: string;
  location?: string | null;
  status: 'OPEN' | 'IN_REVIEW' | 'FOUND' | 'CLOSED';
  resolution_notes?: string | null;
  created_at: string;
};

type AdminMissingReportResponse = {
  rows: AdminMissingReportRow[];
};

const statusClass: Record<AdminMissingReportRow['status'], string> = {
  OPEN: 'bg-peach text-peach-foreground',
  IN_REVIEW: 'bg-lavender text-lavender-foreground',
  FOUND: 'bg-mint text-mint-foreground',
  CLOSED: 'bg-muted text-muted-foreground',
};

const AdminMissingReportsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const reportsQuery = useQuery({
    queryKey: ['admin-missing-reports'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/missing-reports');
      return parseJsonOrThrow<AdminMissingReportResponse>(response, 'Failed to load missing reports');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; status: AdminMissingReportRow['status'] }) => {
      const response = await authenticatedFetch(`/workflows/missing-reports/${payload.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: payload.status,
          resolution_notes:
            payload.status === 'FOUND' ? 'Item located and returned to student.' :
            payload.status === 'CLOSED' ? 'Case closed after verification.' :
            undefined,
        }),
      });
      return parseJsonOrThrow<{ id: string }>(response, 'Failed to update report status');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-missing-reports'] });
    },
  });

  const rows = useMemo(() => {
    const all = reportsQuery.data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((row) =>
      row.student.toLowerCase().includes(q) ||
      row.hostel_id.toLowerCase().includes(q) ||
      row.title.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q),
    );
  }, [reportsQuery.data, search]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Missing Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Track and resolve missing-item cases across the hostel.</p>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by student, hostel ID, title, status"
        className="max-w-md"
      />

      {reportsQuery.isLoading ? <div className="text-sm text-muted-foreground">Loading reports...</div> : null}
      {reportsQuery.error ? <div className="text-sm text-destructive">{(reportsQuery.error as Error).message}</div> : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.description}</p>
                <p className="text-xs text-muted-foreground">
                  {row.student} ({row.hostel_id}) • Room {row.room}
                </p>
                <p className="text-[11px] text-muted-foreground">Created: {new Date(row.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge className={`rounded-full text-[10px] ${statusClass[row.status]}`}>{row.status}</Badge>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" disabled={updateMutation.isPending || row.status === 'IN_REVIEW'} onClick={() => updateMutation.mutate({ id: row.id, status: 'IN_REVIEW' })}>In Review</Button>
                  <Button size="sm" className="rounded-lg" disabled={updateMutation.isPending || row.status === 'FOUND'} onClick={() => updateMutation.mutate({ id: row.id, status: 'FOUND' })}>Mark Found</Button>
                  <Button size="sm" variant="outline" className="rounded-lg" disabled={updateMutation.isPending || row.status === 'CLOSED'} onClick={() => updateMutation.mutate({ id: row.id, status: 'CLOSED' })}>Close</Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!reportsQuery.isLoading && rows.length === 0 ? (
          <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No missing reports found.</div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminMissingReportsPage;
