import { motion } from 'framer-motion';
import { CalendarCheck, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type AttendanceResponse = {
  date: string;
  summary: {
    present: number;
    absent: number;
    on_leave: number;
    late_return: number;
  };
  rows: Array<{
    id: string;
    name: string;
    room: string;
    status: string;
    remarks: string;
  }>;
};

const StudentAttendancePage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-attendance'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/attendance');
      return parseJsonOrThrow<AttendanceResponse>(response, 'Failed to load attendance');
    },
  });

  const summary = data?.summary || { present: 0, absent: 0, on_leave: 0, late_return: 0 };
  const total = Math.max(1, summary.present + summary.absent + summary.on_leave + summary.late_return);
  const attendanceSummary = {
    total,
    present: summary.present,
    absent: summary.absent,
    percentage: `${Math.round((summary.present / total) * 100)}%`,
  };

  const recentDays = (data?.rows || []).slice(0, 10).map((row) => ({
    id: row.id,
    date: row.room,
    day: row.name,
    status: row.status,
  }));

  return (
  <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">Attendance</h1>
      <p className="text-xs text-muted-foreground mt-0.5">Your attendance summary</p>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading attendance...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    {/* Summary */}
    <div className="grid grid-cols-2 gap-3">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-mint p-4 shadow-card col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-mint-foreground font-medium">Overall Attendance</p>
            <p className="font-display text-3xl font-bold text-foreground">{attendanceSummary.percentage}</p>
          </div>
          <div className="rounded-xl bg-card/70 p-3">
            <CalendarCheck className="h-6 w-6 text-mint-foreground" />
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl bg-card p-4 shadow-card text-center">
        <p className="font-display text-2xl font-bold text-foreground">{attendanceSummary.present}</p>
        <p className="text-xs text-muted-foreground">Present</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl bg-card p-4 shadow-card text-center">
        <p className="font-display text-2xl font-bold text-foreground">{attendanceSummary.absent}</p>
        <p className="text-xs text-muted-foreground">Absent</p>
      </motion.div>
    </div>

    {/* Recent days */}
    <div className="rounded-2xl bg-card p-5 shadow-card">
      <h3 className="font-display font-semibold text-sm text-foreground mb-3">Recent Days</h3>
      <div className="space-y-1">
        {recentDays.map((d, i) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center justify-between py-2 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 truncate">{d.day}</span>
              <span className="text-sm text-foreground">{d.date}</span>
            </div>
            {d.status === 'PRESENT' && <CheckCircle className="h-5 w-5 text-primary" />}
            {d.status === 'ABSENT' && <XCircle className="h-5 w-5 text-destructive" />}
            {d.status !== 'PRESENT' && d.status !== 'ABSENT' && <span className="text-xs text-muted-foreground">{d.status}</span>}
          </motion.div>
        ))}
        {!isLoading && recentDays.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No attendance rows available.</p>
        ) : null}
      </div>
    </div>
  </div>
  );
};

export default StudentAttendancePage;
