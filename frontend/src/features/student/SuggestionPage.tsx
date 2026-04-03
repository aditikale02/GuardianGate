import { motion } from 'framer-motion';
import { MessageSquare, Plus, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type SuggestionsResponse = {
  rows: Array<{
    id: string;
    category: string;
    content: string;
    status: string;
    is_anonymous: boolean;
    created_at: string;
    response: string | null;
  }>;
};

const categories = ['Food', 'Cleanliness', 'Safety', 'Wi-Fi', 'Maintenance', 'General'];

const SuggestionPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-suggestions'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/suggestions/my');
      return parseJsonOrThrow<SuggestionsResponse>(response, 'Failed to load suggestions');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/workflows/suggestions', {
        method: 'POST',
        body: JSON.stringify({
          category,
          content,
          is_anonymous: isAnonymous,
        }),
      });
      await parseJsonOrThrow(response, 'Failed to submit suggestion');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-suggestions'] });
      setShowForm(false);
      setCategory('');
      setContent('');
      setIsAnonymous(false);
    },
  });

  const suggestions = data?.rows || [];

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Suggestion Box</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Share feedback & suggestions</p>
        </div>
        <Button size="sm" className="rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Submit Suggestion</h3>
          <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Select category</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea placeholder="Your suggestion, complaint, or feedback..." className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-none" value={content} onChange={(e) => setContent(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="rounded" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} /> Submit anonymously
          </label>
          <Button className="w-full rounded-xl" onClick={() => createMutation.mutate()} disabled={!category || !content || createMutation.isPending}><Send className="h-4 w-4 mr-1" /> {createMutation.isPending ? 'Submitting...' : 'Submit'}</Button>
        </motion.div>
      )}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading suggestions...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge className="rounded-full text-[10px] bg-lavender text-lavender-foreground">{s.category}</Badge>
                {s.is_anonymous && <Badge className="rounded-full text-[10px] bg-muted text-muted-foreground">Anonymous</Badge>}
              </div>
                <Badge className={`rounded-full text-[10px] ${s.status === 'responded' ? 'bg-lavender text-lavender-foreground' : 'bg-peach text-peach-foreground'}`}>
                {s.status}
              </Badge>
            </div>
            <p className="text-sm text-foreground">{s.content}</p>
            {s.response && (
              <div className="mt-2 rounded-xl bg-mint/30 p-3">
                <p className="text-xs text-foreground"><span className="font-semibold">Warden:</span> {s.response}</p>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-2">{new Date(s.created_at).toLocaleDateString()}</p>
          </motion.div>
        ))}
        {!isLoading && suggestions.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No suggestions submitted yet.</div> : null}
      </div>
    </div>
  );
};

export default SuggestionPage;
