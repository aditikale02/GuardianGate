import { AlertTriangle, CalendarCheck, Search } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AttendanceStatusUi = 'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'LATE_RETURN';

type FloorOptionsResponse = {
  hostels: Array<{
    id: string;
    name: string;
    floors: Array<{
      floor_number: number;
      room_count: number;
    }>;
  }>;
  sessions: Array<'NIGHT'>;
};

type FloorAttendanceResponse = {
  filters: {
    hostel_id: string;
    hostel_name: string;
    floor_number: number;
    date: string;
    session: 'NIGHT';
  };
  summary: {
    total_rooms: number;
    total_students: number;
    pending_students: number;
    present: number;
    absent: number;
    on_leave: number;
    late_return: number;
  };
  rooms: Array<{
    room_id: string;
    room_number: string;
    status: string;
    total_students: number;
    summary: {
      total: number;
      present: number;
      absent: number;
      on_leave: number;
      late_return: number;
      pending: number;
    };
    students: Array<{
      student_id: string;
      attendance_id: string | null;
      name: string;
      enrollment_no: string;
      hostel_id: string;
      bed_number: number;
      status: AttendanceStatusUi | null;
      remarks: string;
      marked_time: string | null;
    }>;
  }>;
};

type SaveAttendanceResponse = {
  message: string;
  updated_count: number;
  date: string;
  session: 'NIGHT';
};

type DraftStudent = {
  student_id: string;
  status: AttendanceStatusUi | null;
  remarks: string;
};

const statusOptions: Array<{ value: AttendanceStatusUi; label: string }> = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'ON_LEAVE', label: 'Leave' },
  { value: 'LATE_RETURN', label: 'Late Entry' },
];

const statusBadgeClass: Record<AttendanceStatusUi, string> = {
  PRESENT: 'bg-mint text-mint-foreground',
  ABSENT: 'bg-destructive/15 text-destructive',
  ON_LEAVE: 'bg-peach text-peach-foreground',
  LATE_RETURN: 'bg-lavender text-lavender-foreground',
};

const isoToday = () => new Date().toISOString().slice(0, 10);

const toDraftMap = (rooms: FloorAttendanceResponse['rooms']) => {
  const draft = new Map<string, DraftStudent>();
  for (const room of rooms) {
    for (const student of room.students) {
      draft.set(student.student_id, {
        student_id: student.student_id,
        status: student.status,
        remarks: student.remarks || '',
      });
    }
  }
  return draft;
};

const countUnsavedChanges = (current: Map<string, DraftStudent>, baseline: Map<string, DraftStudent>) => {
  let changed = 0;
  for (const [studentId, baselineRow] of baseline.entries()) {
    const currentRow = current.get(studentId) || { student_id: studentId, status: null, remarks: '' };
    const baselineStatus = baselineRow.status || null;
    const currentStatus = currentRow.status || null;
    const baselineRemarks = (baselineRow.remarks || '').trim();
    const currentRemarks = (currentRow.remarks || '').trim();
    if (baselineStatus !== currentStatus || baselineRemarks !== currentRemarks) {
      changed += 1;
    }
  }
  return changed;
};

const AttendancePage = () => {
  const queryClient = useQueryClient();
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(isoToday());
  const [attendanceSession] = useState<'NIGHT'>('NIGHT');
  const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('CARD');
  const [search, setSearch] = useState('');
  const [draftMap, setDraftMap] = useState<Map<string, DraftStudent>>(new Map());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: optionsData } = useQuery({
    queryKey: ['attendance-floor-options'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/attendance/floor/options');
      return parseJsonOrThrow<FloorOptionsResponse>(response, 'Failed to load floor options');
    },
  });

  const hostelOptions = optionsData?.hostels || [];
  const selectedHostel = hostelOptions.find((item) => item.id === selectedHostelId) || null;
  const floorOptions = selectedHostel?.floors || [];

  const floorAttendanceQuery = useQuery({
    queryKey: ['attendance-floor-data', selectedHostelId, selectedFloor, selectedDate, attendanceSession],
    enabled: Boolean(selectedHostelId && selectedFloor && selectedDate),
    queryFn: async () => {
      const params = new URLSearchParams({
        hostel_id: selectedHostelId,
        floor: selectedFloor,
        date: selectedDate,
        session: attendanceSession,
      });
      const response = await authenticatedFetch(`/dashboard/attendance/floor?${params.toString()}`);
      return parseJsonOrThrow<FloorAttendanceResponse>(response, 'Failed to load floor attendance');
    },
  });

  const floorData = floorAttendanceQuery.data;

  const baselineDraft = useMemo(
    () => (floorData ? toDraftMap(floorData.rooms) : new Map<string, DraftStudent>()),
    [floorData],
  );

  const saveMutation = useMutation({
    mutationFn: async (updates: Array<{ student_id: string; status: AttendanceStatusUi; remarks: string }>) => {
      if (!selectedHostelId || !selectedFloor || !selectedDate) {
        throw new Error('Please select hostel, floor and date first');
      }
      const response = await authenticatedFetch('/dashboard/attendance/floor/save', {
        method: 'POST',
        body: JSON.stringify({
          hostel_id: selectedHostelId,
          floor_number: Number(selectedFloor),
          date: selectedDate,
          session: attendanceSession,
          updates,
        }),
      });
      return parseJsonOrThrow<SaveAttendanceResponse>(response, 'Failed to save attendance');
    },
    onSuccess: (result) => {
      setSaveError(null);
      setSaveMessage(`${result.message} (${result.updated_count} students)`);
      queryClient.invalidateQueries({ queryKey: ['attendance-floor-data'] });
    },
    onError: (error: unknown) => {
      setSaveMessage(null);
      setSaveError(error instanceof Error ? error.message : 'Failed to save attendance');
    },
  });

  useEffect(() => {
    if (!floorData) return;
    setDraftMap(toDraftMap(floorData.rooms));
    setSaveError(null);
    setSaveMessage(null);
  }, [floorData]);

  const currentDraft = useMemo(() => {
    if (!floorData) return new Map<string, DraftStudent>();
    if (draftMap.size === 0) {
      return toDraftMap(floorData.rooms);
    }
    return draftMap;
  }, [draftMap, floorData]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rooms = floorData?.rooms || [];
    if (!q) return rooms;

    return rooms
      .map((room) => ({
        ...room,
        students: room.students.filter((student) =>
          student.name.toLowerCase().includes(q) ||
          student.enrollment_no.toLowerCase().includes(q) ||
          room.room_number.toLowerCase().includes(q),
        ),
      }))
      .filter((room) => room.room_number.toLowerCase().includes(q) || room.students.length > 0);
  }, [floorData?.rooms, search]);

  const setStudentStatus = (studentId: string, status: AttendanceStatusUi) => {
    setDraftMap((prev) => {
      const next = new Map(prev);
      const current = next.get(studentId) || { student_id: studentId, status: null, remarks: '' };
      next.set(studentId, { ...current, status });
      return next;
    });
  };

  const setStudentRemarks = (studentId: string, remarks: string) => {
    setDraftMap((prev) => {
      const next = new Map(prev);
      const current = next.get(studentId) || { student_id: studentId, status: null, remarks: '' };
      next.set(studentId, { ...current, remarks });
      return next;
    });
  };

  const markAllPresentForRoom = (roomId: string) => {
    const room = floorData?.rooms.find((item) => item.room_id === roomId);
    if (!room) return;
    setDraftMap((prev) => {
      const next = new Map(prev);
      for (const student of room.students) {
        const current = next.get(student.student_id) || { student_id: student.student_id, status: null, remarks: '' };
        next.set(student.student_id, { ...current, status: 'PRESENT' });
      }
      return next;
    });
  };

  const markAllPresentForFloor = () => {
    const rooms = floorData?.rooms || [];
    setDraftMap((prev) => {
      const next = new Map(prev);
      for (const room of rooms) {
        for (const student of room.students) {
          const current = next.get(student.student_id) || { student_id: student.student_id, status: null, remarks: '' };
          next.set(student.student_id, { ...current, status: 'PRESENT' });
        }
      }
      return next;
    });
  };

  const saveRoom = (roomId: string) => {
    const room = floorData?.rooms.find((item) => item.room_id === roomId);
    if (!room) return;

    const updates = room.students
      .map((student) => {
        const draft = currentDraft.get(student.student_id);
        if (!draft?.status) return null;
        return {
          student_id: student.student_id,
          status: draft.status,
          remarks: draft.remarks || '',
        };
      })
      .filter((item): item is { student_id: string; status: AttendanceStatusUi; remarks: string } => item !== null);

    if (updates.length === 0) {
      setSaveError('No marked students in selected room');
      return;
    }

    setSaveError(null);
    saveMutation.mutate(updates);
  };

  const saveFloor = () => {
    const updates = Array.from(currentDraft.values())
      .filter((item) => Boolean(item.status))
      .map((item) => ({
        student_id: item.student_id,
        status: item.status as AttendanceStatusUi,
        remarks: item.remarks || '',
      }));

    if (updates.length === 0) {
      setSaveError('No attendance status selected to save');
      return;
    }

    setSaveError(null);
    saveMutation.mutate(updates);
  };

  const summary = floorData?.summary || {
    total_rooms: 0,
    total_students: 0,
    pending_students: 0,
    present: 0,
    absent: 0,
    on_leave: 0,
    late_return: 0,
  };

  const total = Math.max(1, summary.total_students || (summary.present + summary.absent + summary.on_leave + summary.late_return));
  const average = Math.round((summary.present / total) * 100);

  const pendingRooms = useMemo(() => {
    return (floorData?.rooms || []).filter((room) => {
      return room.students.some((student) => {
        const draft = currentDraft.get(student.student_id);
        return !(draft?.status || student.status);
      });
    }).length;
  }, [currentDraft, floorData?.rooms]);

  const unsavedChangesCount = useMemo(
    () => countUnsavedChanges(currentDraft, baselineDraft),
    [baselineDraft, currentDraft],
  );

  const resetDraftChanges = () => {
    setDraftMap(new Map(baselineDraft));
    setSaveError(null);
    setSaveMessage(null);
  };

  return (
  <div className="max-w-7xl space-y-6">
    <h1 className="font-display text-2xl font-bold text-foreground">Night Attendance</h1>
    <p className="text-sm text-muted-foreground">Select hostel, floor and date to load all rooms on one page.</p>

    <div className="rounded-2xl bg-card p-4 shadow-card space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Hostel / Building</p>
          <select
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={selectedHostelId}
            onChange={(event) => {
              setSelectedHostelId(event.target.value);
              setSelectedFloor('');
              setDraftMap(new Map());
            }}
          >
            <option value="">Select hostel</option>
            {hostelOptions.map((hostel) => (
              <option key={hostel.id} value={hostel.id}>{hostel.name}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Floor</p>
          <select
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={selectedFloor}
            onChange={(event) => {
              setSelectedFloor(event.target.value);
              setDraftMap(new Map());
            }}
            disabled={!selectedHostelId}
          >
            <option value="">Select floor</option>
            {floorOptions.map((floor) => (
              <option key={floor.floor_number} value={String(floor.floor_number)}>
                Floor {floor.floor_number} ({floor.room_count} rooms)
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Date</p>
          <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Attendance Session</p>
          <Input value="Night" readOnly />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={viewMode === 'CARD' ? 'default' : 'outline'}
          className="rounded-xl"
          onClick={() => setViewMode('CARD')}
        >
          Card View
        </Button>
        <Button
          variant={viewMode === 'TABLE' ? 'default' : 'outline'}
          className="rounded-xl"
          onClick={() => setViewMode('TABLE')}
        >
          Table View
        </Button>
        <Button className="rounded-xl" variant="outline" onClick={markAllPresentForFloor} disabled={!floorData}>
          Mark All Present (Floor)
        </Button>
        <Button className="rounded-xl" variant="outline" onClick={resetDraftChanges} disabled={!floorData || unsavedChangesCount === 0}>
          Reset Changes
        </Button>
        <Button className="rounded-xl" onClick={saveFloor} disabled={!floorData || saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Attendance'}
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Search by room or student"
        />
      </div>
    </div>

    {floorAttendanceQuery.isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading floor attendance...</div> : null}
    {floorAttendanceQuery.error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(floorAttendanceQuery.error as Error).message}</div> : null}
    {saveMessage ? <div className="rounded-2xl bg-card p-4 text-sm text-primary">{saveMessage}</div> : null}
    {saveError ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{saveError}</div> : null}

    {floorData ? (
      <div className="rounded-2xl bg-card p-4 shadow-card flex items-center gap-3 text-sm">
        <AlertTriangle className={`h-4 w-4 ${pendingRooms > 0 ? 'text-destructive' : 'text-mint-foreground'}`} />
        <p className="text-foreground">
          Pending rooms: <span className="font-semibold">{pendingRooms}</span> / {summary.total_rooms}
        </p>
        <p className="text-muted-foreground">• Unsaved changes: {unsavedChangesCount}</p>
      </div>
    ) : null}

    <div className="grid md:grid-cols-3 gap-6">
      <div className="rounded-2xl bg-card shadow-card p-6 md:col-span-2">
        <h3 className="font-display font-semibold text-foreground mb-4">
          Floor Summary ({floorData?.filters.date || '--'})
        </h3>
        <div className="space-y-3">
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">Present</p>
            <Progress value={(summary.present / total) * 100} className="h-2" />
            <p className="text-xs text-foreground mt-1">{summary.present} students</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">Absent</p>
            <Progress value={(summary.absent / total) * 100} className="h-2" />
            <p className="text-xs text-foreground mt-1">{summary.absent} students</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">On Leave / Late Return</p>
            <Progress value={((summary.on_leave + summary.late_return) / total) * 100} className="h-2" />
            <p className="text-xs text-foreground mt-1">{summary.on_leave + summary.late_return} students</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">Pending</p>
            <Progress value={(summary.pending_students / total) * 100} className="h-2" />
            <p className="text-xs text-foreground mt-1">{summary.pending_students} students</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card shadow-card p-6 space-y-6">
        <h3 className="font-display font-semibold text-foreground">Summary</h3>
        <div className="rounded-xl bg-mint/50 p-4 text-center">
          <CalendarCheck className="h-8 w-8 text-mint-foreground mx-auto" />
          <p className="font-display text-3xl font-bold text-foreground mt-2">{average}%</p>
          <p className="text-xs text-muted-foreground mt-1">Present Rate</p>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm"><span className="text-foreground">Rooms</span><span className="text-muted-foreground">{summary.total_rooms}</span></div>
          <div className="flex justify-between text-sm"><span className="text-foreground">Students</span><span className="text-muted-foreground">{summary.total_students}</span></div>
          <div className="flex justify-between text-sm"><span className="text-foreground">Present</span><span className="text-muted-foreground">{summary.present}</span></div>
          <div className="flex justify-between text-sm"><span className="text-foreground">Late Return</span><span className="text-muted-foreground">{summary.late_return}</span></div>
          <div className="flex justify-between text-sm"><span className="text-foreground">Absent</span><span className="text-muted-foreground">{summary.absent}</span></div>
          <div className="flex justify-between text-sm"><span className="text-foreground">Pending</span><span className="text-muted-foreground">{summary.pending_students}</span></div>
        </div>
      </div>
    </div>

    {floorData && viewMode === 'CARD' ? (
      <div className="grid gap-4 lg:grid-cols-2">
        {filteredRooms.map((room) => {
          const hasPending = room.students.some((student) => {
            const draft = currentDraft.get(student.student_id);
            return !(draft?.status || student.status);
          });

          return (
            <motion.div key={room.room_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl bg-card p-4 shadow-card ${hasPending ? 'border border-destructive/30' : ''}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">Room {room.room_number}</p>
                  <p className="text-xs text-muted-foreground">{room.total_students} students</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => markAllPresentForRoom(room.room_id)}>
                    Mark All Present
                  </Button>
                  <Button size="sm" className="rounded-lg" onClick={() => saveRoom(room.room_id)} disabled={saveMutation.isPending}>
                    Save / Update
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {room.students.map((student) => {
                  const draft = currentDraft.get(student.student_id);
                  const currentStatus = draft?.status || student.status;
                  return (
                    <div key={student.student_id} className="rounded-xl border border-border/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.enrollment_no} • Bed {student.bed_number}</p>
                        </div>
                        {currentStatus ? (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusBadgeClass[currentStatus]}`}>{currentStatus.replace('_', ' ').toLowerCase()}</span>
                        ) : (
                          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive">pending</span>
                        )}
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <select
                          className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
                          value={currentStatus || ''}
                          onChange={(event) => setStudentStatus(student.student_id, event.target.value as AttendanceStatusUi)}
                        >
                          <option value="">Select Status</option>
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <Input
                          value={draft?.remarks ?? student.remarks ?? ''}
                          onChange={(event) => setStudentRemarks(student.student_id, event.target.value)}
                          placeholder="Remarks"
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    ) : null}

    {floorData && viewMode === 'TABLE' ? (
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Manual / Table View</p>
          <Button size="sm" variant="outline" className="rounded-lg" onClick={markAllPresentForFloor}>Mark All Present (Floor)</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left text-xs text-muted-foreground">Room Number</th>
                <th className="px-2 py-2 text-left text-xs text-muted-foreground">Student Name</th>
                <th className="px-2 py-2 text-left text-xs text-muted-foreground">Enrollment No</th>
                <th className="px-2 py-2 text-left text-xs text-muted-foreground">Attendance Status</th>
                <th className="px-2 py-2 text-left text-xs text-muted-foreground">Remarks</th>
                <th className="px-2 py-2 text-left text-xs text-muted-foreground">Marked Time</th>
                <th className="px-2 py-2 text-left text-xs text-muted-foreground">Bulk</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.flatMap((room) => room.students.map((student, index) => {
                const draft = currentDraft.get(student.student_id);
                const currentStatus = draft?.status || student.status;
                return (
                  <tr key={student.student_id} className="border-b border-border/60">
                    <td className="px-2 py-2 text-xs text-foreground">
                      {room.room_number}
                    </td>
                    <td className="px-2 py-2 text-xs text-foreground">{student.name}</td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{student.enrollment_no}</td>
                    <td className="px-2 py-2">
                      <select
                        className="h-8 w-36 rounded-lg border border-input bg-background px-2 text-xs"
                        value={currentStatus || ''}
                        onChange={(event) => setStudentStatus(student.student_id, event.target.value as AttendanceStatusUi)}
                      >
                        <option value="">Select</option>
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        className="h-8 text-xs"
                        value={draft?.remarks ?? student.remarks ?? ''}
                        onChange={(event) => setStudentRemarks(student.student_id, event.target.value)}
                        placeholder="Remarks"
                      />
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{student.marked_time ? new Date(student.marked_time).toLocaleTimeString() : '--'}</td>
                    <td className="px-2 py-2 text-xs">
                      {index === 0 ? (
                        <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => markAllPresentForRoom(room.room_id)}>
                          Mark Room Present
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <Button className="rounded-xl" onClick={saveFloor} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Attendance'}
          </Button>
        </div>
      </div>
    ) : null}

    {floorData && unsavedChangesCount > 0 ? (
      <div className="sticky bottom-4 z-30 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-foreground">
            {unsavedChangesCount} pending attendance change{unsavedChangesCount > 1 ? 's' : ''} not saved.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" onClick={resetDraftChanges} disabled={saveMutation.isPending}>
              Reset
            </Button>
            <Button className="rounded-xl" onClick={saveFloor} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        </div>
      </div>
    ) : null}
  </div>
  );
};

export default AttendancePage;
