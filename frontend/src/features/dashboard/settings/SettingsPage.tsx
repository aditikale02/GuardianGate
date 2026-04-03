import { Settings as SettingsIcon, Bell, Shield, Palette } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

const sections = [
  { icon: Bell, title: 'Notifications', items: [
    { label: 'Email notifications', desc: 'Receive alerts via email', default: true },
    { label: 'Push notifications', desc: 'Browser push alerts', default: false },
    { label: 'Late return alerts', desc: 'Alert when students miss curfew', default: true },
  ]},
  { icon: Shield, title: 'Security', items: [
    { label: 'Two-factor auth', desc: 'Extra login security', default: false },
    { label: 'Session timeout', desc: 'Auto-logout after 30 minutes', default: true },
  ]},
];

type SettingsResponse = {
  default_gate: string;
  attendance_cutoff_time: string;
  alert_email: string;
};

const SettingsPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/settings');
      return parseJsonOrThrow<SettingsResponse>(response, 'Failed to load settings');
    },
  });

  return (
  <div className="max-w-2xl space-y-6">
    <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
    <p className="text-sm text-muted-foreground">Manage your preferences</p>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading settings...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="rounded-2xl bg-card shadow-card p-6 space-y-2">
      <h3 className="font-display font-semibold text-foreground">System Settings</h3>
      <p className="text-sm text-muted-foreground">Default Gate: {data?.default_gate || '--'}</p>
      <p className="text-sm text-muted-foreground">Attendance Cutoff: {data?.attendance_cutoff_time || '--'}</p>
      <p className="text-sm text-muted-foreground">Alert Email: {data?.alert_email || '--'}</p>
    </div>

    {sections.map((s) => (
      <div key={s.title} className="rounded-2xl bg-card shadow-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <s.icon className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">{s.title}</h3>
        </div>
        {s.items.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch defaultChecked={item.default} />
          </div>
        ))}
      </div>
    ))}
  </div>
  );
};

export default SettingsPage;
