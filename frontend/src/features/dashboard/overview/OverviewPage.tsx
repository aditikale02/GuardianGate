import { motion } from 'framer-motion';
import { Users, Inbox, Wrench, Stethoscope, Package, Sparkles, CreditCard, AlertTriangle, Calendar, CheckCircle, XCircle, UserCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import MetricCard from '@/components/MetricCard/MetricCard';
import { useOutletContext } from 'react-router-dom';
import { UserRole } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35 },
  }),
};

type OverviewResponse = {
  stats: { total: number; in: number; out: number };
  security: { invalid_total: number };
};

type RequestsResponse = {
  summary: { pending: number; approved: number; rejected: number };
  rows: Array<{
    id: string;
    student: string;
    type: string;
    submitted_at: string;
    status: string;
  }>;
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-peach text-peach-foreground',
  APPROVED: 'bg-mint text-mint-foreground',
  REJECTED: 'bg-destructive/15 text-destructive',
  CANCELLED: 'bg-lavender text-lavender-foreground',
};

const requestIconMap: Record<string, LucideIcon> = {
  LEAVE: Inbox,
  GUEST: UserCheck,
};

const WardenOverviewPage = () => {
  const { user } = useOutletContext<{ role: UserRole; user: { name: string } }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['overview-page-data'],
    queryFn: async () => {
      const [overviewRes, requestsRes] = await Promise.all([
        authenticatedFetch('/dashboard/overview'),
        authenticatedFetch('/dashboard/requests'),
      ]);

      const overview = await parseJsonOrThrow<OverviewResponse>(overviewRes, 'Failed to load overview');
      const requests = await parseJsonOrThrow<RequestsResponse>(requestsRes, 'Failed to load requests');

      return { overview, requests };
    },
  });

  const stats = [
    { title: 'Total Students', value: data?.overview.stats.total ?? 0, icon: Users, variant: 'peach' as const, trend: `Inside: ${data?.overview.stats.in ?? 0}` },
    { title: 'Pending Requests', value: data?.requests.summary.pending ?? 0, icon: Inbox, variant: 'blush' as const, trend: `Approved: ${data?.requests.summary.approved ?? 0}` },
    { title: 'Students Out', value: data?.overview.stats.out ?? 0, icon: Calendar, variant: 'lavender' as const, trend: 'Current gate status' },
    { title: 'Invalid Scans', value: data?.overview.security.invalid_total ?? 0, icon: AlertTriangle, variant: 'mint' as const, trend: 'Security exceptions' },
  ];

  const recentRequests = (data?.requests.rows ?? []).slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Welcome */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="rounded-2xl gradient-hero p-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
          Welcome, <span className="text-primary">{user.name.split(' ')[0]}</span> 👋
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Here's your hostel management overview for today.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.title} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
            <MetricCard {...s} />
          </motion.div>
        ))}
      </div>

      {/* Quick summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Approved Requests', value: data?.requests.summary.approved ?? 0, icon: Package, bg: 'bg-peach' },
          { label: 'Rejected Requests', value: data?.requests.summary.rejected ?? 0, icon: Sparkles, bg: 'bg-lavender' },
          { label: 'Pending Requests', value: data?.requests.summary.pending ?? 0, icon: CreditCard, bg: 'bg-blush' },
          { label: 'Invalid Scans', value: data?.overview.security.invalid_total ?? 0, icon: AlertTriangle, bg: 'bg-destructive/10' },
        ].map((item, i) => (
          <motion.div key={item.label} initial="hidden" animate="visible" variants={fadeUp} custom={i + 5}
            className={`rounded-2xl ${item.bg} p-4 shadow-card`}
          >
            <item.icon className="h-5 w-5 text-foreground mb-2" />
            <p className="font-display text-xl font-bold text-foreground">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Requests */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={9}>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">Recent Requests</h2>
        {isLoading ? (
          <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading latest requests...</div>
        ) : null}
        {error ? (
          <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div>
        ) : null}
        <div className="space-y-3">
          {recentRequests.map((r, i) => {
            const Icon = requestIconMap[r.type] || Inbox;
            return (
            <motion.div key={i} initial="hidden" animate="visible" variants={fadeUp} custom={i + 10}
              className="rounded-2xl bg-card p-4 shadow-card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-peach p-2.5">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.student}</p>
                  <p className="text-xs text-muted-foreground">{r.type} • {new Date(r.submitted_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusColors[r.status] || 'bg-lavender text-lavender-foreground'}`}>{r.status.toLowerCase()}</span>
                {r.status === 'PENDING' ? (
                  <div className="flex gap-1">
                    <button className="rounded-lg bg-mint p-1.5 hover:opacity-80 transition-opacity"><CheckCircle className="h-4 w-4 text-mint-foreground" /></button>
                    <button className="rounded-lg bg-destructive/15 p-1.5 hover:opacity-80 transition-opacity"><XCircle className="h-4 w-4 text-destructive" /></button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          );
          })}
          {!isLoading && !error && recentRequests.length === 0 ? (
            <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No recent requests found.</div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
};

export default WardenOverviewPage;
