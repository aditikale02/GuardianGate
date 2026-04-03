import { Shield, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';
import { useNavigate } from 'react-router-dom';

type WardensResponse = {
  rows: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    shift: string;
  }>;
};

const WardensPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-wardens'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/wardens');
      return parseJsonOrThrow<WardensResponse>(response, 'Failed to load wardens');
    },
  });

  const wardens = useMemo(() => {
    const rows = data?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) => item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q));
  }, [data, search]);

  return (
  <div className="max-w-4xl space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Wardens</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage warden assignments</p>
      </div>
      <Button className="rounded-xl" onClick={() => navigate('/admin/users?create=warden')}>+ Add Warden</Button>
    </div>

    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 max-w-md">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        placeholder="Search wardens..."
        className="bg-transparent text-sm outline-none w-full"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading wardens...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="grid sm:grid-cols-2 gap-4">
      {wardens.map((w, i) => (
        <motion.div
          key={w.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-2xl bg-card shadow-card p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-lavender flex items-center justify-center">
              <Shield className="h-5 w-5 text-lavender-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">{w.name}</h3>
              <p className="text-xs text-muted-foreground">{w.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{w.shift} Shift</span>
            <span>•</span>
            <Badge className={`rounded-full text-xs ${w.role === 'ADMIN' ? 'bg-lavender text-lavender-foreground' : 'bg-mint text-mint-foreground'}`}>
              {w.role.toLowerCase()}
            </Badge>
          </div>
        </motion.div>
      ))}
      {!isLoading && wardens.length === 0 ? (
        <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No wardens found.</div>
      ) : null}
    </div>
  </div>
  );
};

export default WardensPage;
