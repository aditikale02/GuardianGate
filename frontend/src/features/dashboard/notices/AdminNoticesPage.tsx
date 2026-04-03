import { Plus, Search, Megaphone, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type NoticesResponse = {
  rows: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    is_pinned: boolean;
    published_at: string;
  }>;
};

const AdminNoticesPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['campus-notices-admin'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/notices');
      return parseJsonOrThrow<NoticesResponse>(response, 'Failed to load notices');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch('/campus/notices', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          target_role: targetRole || null,
          is_pinned: isPinned,
        }),
      });
      await parseJsonOrThrow(response, 'Failed to publish notice');
    },
    onSuccess: () => {
      setShowForm(false);
      setTitle('');
      setContent('');
      setTargetRole('');
      setIsPinned(false);
      queryClient.invalidateQueries({ queryKey: ['campus-notices-admin'] });
    },
  });

  const notices = data?.rows || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Notices & Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">Publish and manage hostel notices</p>
        </div>
        <Button className="rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> New Notice
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
          <Input placeholder="Notice title" className="rounded-xl" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
            <option value="">All Roles</option>
            <option value="STUDENT">Student</option>
            <option value="WARDEN">Warden</option>
            <option value="ADMIN">Admin</option>
          </select>
          <textarea placeholder="Notice content..." className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-none" value={content} onChange={(e) => setContent(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} /> Pin this notice</label>
          <Button className="w-full rounded-xl" onClick={() => createMutation.mutate()} disabled={!title || !content || createMutation.isPending}>{createMutation.isPending ? 'Publishing...' : 'Publish Notice'}</Button>
        </motion.div>
      )}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading notices...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="space-y-3">
        {notices.map((n, i) => (
          <motion.div key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-4 shadow-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-lavender p-2.5"><Megaphone className="h-5 w-5 text-lavender-foreground" /></div>
              <div>
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.category} • {new Date(n.published_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {n.is_pinned && <Badge className="rounded-full text-[10px] bg-primary/15 text-primary">Pinned</Badge>}
              <button className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminNoticesPage;
