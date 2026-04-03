import { motion } from 'framer-motion';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';
import { useNavigate } from 'react-router-dom';

type StudentsResponse = {
  rows: Array<{
    id: string;
    name: string;
    room: string;
    status: 'IN' | 'OUT';
    hostel_id: string;
  }>;
};

const statusStyles: Record<string, string> = {
  IN: 'bg-mint text-mint-foreground',
  OUT: 'bg-blush text-blush-foreground',
};

const StudentsPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/students');
      return parseJsonOrThrow<StudentsResponse>(response, 'Failed to load students');
    },
  });

  const students = useMemo(() => {
    const rows = data?.rows || [];
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((student) =>
      student.name.toLowerCase().includes(needle) ||
      student.hostel_id.toLowerCase().includes(needle) ||
      student.room.toLowerCase().includes(needle),
    );
  }, [data, searchTerm]);

  return (
    <div className="max-w-7xl space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Students</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage all registered students</p>
      </div>
      <Button className="rounded-xl" onClick={() => navigate('/admin/users?create=student')}>+ Add Student</Button>
    </div>

    <div className="rounded-2xl bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2 flex-1 rounded-xl bg-muted px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search students..."
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-2">
          <Filter className="h-4 w-4" /> Filter
        </Button>
      </div>

      {isLoading ? <div className="px-4 py-3 text-sm text-muted-foreground">Loading students...</div> : null}
      {error ? <div className="px-4 py-3 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Room</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Floor</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Scan</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.hostel_id}</td>
                <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.room}</td>
                <td className="px-4 py-3 text-muted-foreground">--</td>
                <td className="px-4 py-3">
                  <Badge className={`rounded-full text-xs ${statusStyles[s.status]}`}>{s.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">--</td>
              </motion.tr>
            ))}
            {!isLoading && students.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">No students found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between p-4 border-t border-border">
        <span className="text-sm text-muted-foreground">Showing {students.length} of {data?.rows.length ?? 0}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="rounded-xl h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="rounded-xl h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  </div>
  );
};

export default StudentsPage;
