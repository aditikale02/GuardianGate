import { MessageSquare, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type SuggestionsResponse = {
  rows: Array<{
    id: string;
    category: string;
    content: string;
    student: string;
    status: string;
    response: string | null;
    created_at: string;
  }>;
};

const AdminSuggestionsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-suggestions'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/suggestions');
      return parseJsonOrThrow<SuggestionsResponse>(response, 'Failed to load suggestions');
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, responseText }: { id: string; responseText: string }) => {
      const response = await authenticatedFetch(`/workflows/suggestions/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ message: responseText }),
      });
      await parseJsonOrThrow(response, 'Failed to send response');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-suggestions'] }),
  });

  const suggestions = useMemo(() => {
    const rows = data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.category.toLowerCase().includes(q) ||
      row.content.toLowerCase().includes(q) ||
      row.student.toLowerCase().includes(q),
    );
  }, [data, search]);

  const submitResponse = (id: string) => {
    const responseText = (responses[id] || '').trim();
    if (!responseText) return;
    respondMutation.mutate({ id, responseText });
    setResponses((prev) => ({ ...prev, [id]: '' }));
  };

  return (
  <div className="space-y-6 max-w-4xl">
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">Suggestions & Feedback</h1>
      <p className="text-sm text-muted-foreground mt-1">Review and respond to student feedback</p>
    </div>

    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 max-w-md">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input placeholder="Search..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading suggestions...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {suggestions.map((s, i) => (
        <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-5 shadow-card">
          <div className="flex items-start justify-between mb-2">
            <div className="flex gap-2">
              <Badge className="rounded-full text-[10px] bg-lavender text-lavender-foreground">{s.category}</Badge>
              <span className="text-xs text-muted-foreground">{s.student}</span>
            </div>
            <Badge className={`rounded-full text-[10px] ${s.status === 'RESOLVED' ? 'bg-mint text-mint-foreground' : 'bg-peach text-peach-foreground'}`}>{s.status.toLowerCase()}</Badge>
          </div>
          <p className="text-sm text-foreground">{s.content}</p>
          <p className="text-[10px] text-muted-foreground mt-2">{new Date(s.created_at).toLocaleDateString()}</p>
          {s.response ? <p className="text-xs text-muted-foreground mt-2">Response: {s.response}</p> : null}
          {s.status === 'PENDING' && (
            <div className="mt-3 flex gap-2">
              <input placeholder="Type response..." className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-sm" value={responses[s.id] || ''} onChange={(e) => setResponses((prev) => ({ ...prev, [s.id]: e.target.value }))} />
              <button className="rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-4 py-1.5" onClick={() => submitResponse(s.id)}>Reply</button>
            </div>
          )}
        </motion.div>
      ))}
      {!isLoading && suggestions.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No suggestions found.</div> : null}
    </div>
  </div>
  );
};

export default AdminSuggestionsPage;
