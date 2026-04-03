import { motion } from 'framer-motion';
import { AlertTriangle, Zap, Droplets, Wrench as WrenchIcon, Shield, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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

const iconByPriority: Record<string, LucideIcon> = {
  CRITICAL: AlertTriangle,
  HIGH: Zap,
  NORMAL: Shield,
};

const EmergencyPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['campus-emergency-student'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/emergency');
      return parseJsonOrThrow<EmergencyResponse>(response, 'Failed to load emergency alerts');
    },
  });

  const alerts = data?.rows || [];

  return (
  <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">Emergency Alerts</h1>
      <p className="text-xs text-muted-foreground mt-0.5">Important hostel notifications</p>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading emergency alerts...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {alerts.map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className={`rounded-2xl p-4 shadow-card ${a.active ? 'bg-destructive/10 border border-destructive/20' : 'bg-card'}`}
        >
          <div className="flex items-start gap-3">
            <div className={`rounded-xl p-2.5 shrink-0 ${a.active ? 'bg-destructive/20' : 'bg-peach'}`}>
              {(() => {
                const Icon = iconByPriority[a.priority] || Shield;
                return <Icon className={`h-5 w-5 ${a.active ? 'text-destructive' : 'text-peach-foreground'}`} />;
              })()}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                {a.active && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {a.age}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
      {!isLoading && alerts.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No emergency alerts right now.</div> : null}
    </div>
  </div>
  );
};

export default EmergencyPage;
