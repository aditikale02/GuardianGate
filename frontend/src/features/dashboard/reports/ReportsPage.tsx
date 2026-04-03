import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';
import { useMemo, useState } from 'react';

type ReportsResponse = {
  filters: {
    period: 'weekly' | 'monthly' | 'yearly';
    from: string;
    to: string;
  };
  summary: {
    attendance_percent: number;
    attendance_with_leave_percent: number;
    late_returns: number;
    invalid_scans: number;
    students_total: number;
    admissions: number;
    occupancy_percent: number;
    fee_due_total: number;
    fee_paid_total: number;
    fee_pending_total: number;
    leave_requests: number;
    guest_requests: number;
    events_created: number;
    notices_published: number;
    emergencies_created: number;
  };
  charts: {
    attendance: Array<{
      label: string;
      present: number;
      leave: number;
      absent: number;
      late: number;
    }>;
    fees: Array<{
      label: string;
      due: number;
      paid: number;
    }>;
    activity: Array<{
      label: string;
      value: number;
    }>;
  };
};

const formatInr = (value: number) => `Rs ${Math.round(value).toLocaleString('en-IN')}`;

const dateOffset = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

const ReportsPage = () => {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [from, setFrom] = useState(dateOffset(-6));
  const [to, setTo] = useState(dateOffset(0));

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-reports', period, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ period, from, to });
      const response = await authenticatedFetch(`/dashboard/reports?${params.toString()}`);
      return parseJsonOrThrow<ReportsResponse>(response, 'Failed to load reports');
    },
  });

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      { title: 'Attendance', value: `${data.summary.attendance_percent}%` },
      { title: 'Attendance + Leave', value: `${data.summary.attendance_with_leave_percent}%` },
      { title: 'Late Returns', value: `${data.summary.late_returns}` },
      { title: 'Invalid Scans', value: `${data.summary.invalid_scans}` },
      { title: 'Occupancy', value: `${data.summary.occupancy_percent}%` },
      { title: 'Admissions', value: `${data.summary.admissions}` },
      { title: 'Fees Due', value: formatInr(data.summary.fee_due_total) },
      { title: 'Fees Paid', value: formatInr(data.summary.fee_paid_total) },
      { title: 'Fees Pending', value: formatInr(data.summary.fee_pending_total) },
    ];
  }, [data]);

  return (
  <div className="max-w-5xl space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Weekly, monthly, and yearly hostel analytics</p>
      </div>
      <Button className="rounded-xl gap-2"><Download className="h-4 w-4" /> Export</Button>
    </div>

    <div className="rounded-2xl bg-card p-4 shadow-card flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-xs text-muted-foreground">
        Period
        <select
          className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
          value={period}
          onChange={(event) => setPeriod(event.target.value as 'weekly' | 'monthly' | 'yearly')}
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        From
        <input
          type="date"
          className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        To
        <input
          type="date"
          className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </label>
      <div className="text-xs text-muted-foreground">Students total: {data?.summary.students_total ?? 0}</div>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading report metrics...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="grid gap-3 md:grid-cols-3">
      {summaryCards.map((card) => (
        <div key={card.title} className="rounded-2xl bg-card shadow-card p-4">
          <p className="text-xs text-muted-foreground">{card.title}</p>
          <p className="mt-1 font-display text-xl font-semibold text-foreground">{card.value}</p>
        </div>
      ))}
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl bg-card shadow-card p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Attendance Trend</p>
        <div className="space-y-1 text-xs text-muted-foreground max-h-52 overflow-auto pr-1">
          {(data?.charts.attendance || []).map((row) => (
            <div key={row.label} className="flex items-center justify-between border-b border-border/60 py-1">
              <span>{row.label}</span>
              <span>P {row.present} · L {row.leave} · A {row.absent} · LR {row.late}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-card shadow-card p-4">
        <p className="text-sm font-semibold text-foreground mb-2">Fee Trend</p>
        <div className="space-y-1 text-xs text-muted-foreground max-h-52 overflow-auto pr-1">
          {(data?.charts.fees || []).map((row) => (
            <div key={row.label} className="flex items-center justify-between border-b border-border/60 py-1">
              <span>{row.label}</span>
              <span>Due {formatInr(row.due)} · Paid {formatInr(row.paid)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="rounded-2xl bg-card shadow-card p-4">
      <p className="text-sm font-semibold text-foreground mb-2">Activity Snapshot</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {(data?.charts.activity || []).map((item) => (
          <span key={item.label} className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {item.label}: {item.value}
          </span>
        ))}
      </div>
    </div>
  </div>
  );
};

export default ReportsPage;
