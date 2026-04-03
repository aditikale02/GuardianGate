import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEPARTMENT_OPTIONS } from '@/lib/constants';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';
import { toast } from '@/components/ui/sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ShiftTiming = 'DAY' | 'NIGHT' | 'BOTH';

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  username: string;
  phone?: string | null;
  role: 'ADMIN' | 'STUDENT' | 'WARDEN' | string;
  is_active: boolean;
  first_login: boolean;
  credentials_email_status?: string | null;
  credentials_emailed_at?: string | null;
  last_login_at?: string | null;
  student?: {
    hostel_id: string;
    enrollment_no: string;
    department: string;
    course_branch?: string | null;
    year_of_study: number;
    room_allocation?: { room: { room_number: string } } | null;
    assigned_warden?: { id: string; full_name: string } | null;
    leave_balance?: number;
  } | null;
  warden_profile?: {
    warden_id: string;
    assigned_hostel: string;
    assigned_block?: string | null;
    assigned_floor?: string | null;
    shift_timing: ShiftTiming;
  } | null;
  _count?: {
    assigned_students?: number;
  };
};

type UsersResponse = {
  users: UserRow[];
  meta?: {
    total: number;
    page: number;
    page_size: number;
  };
};

type ProvisionResponse = {
  message: string;
  credentials_email_sent: boolean;
  credentials_email_error?: string;
};

type ProvisionMode = 'student' | 'warden';
type ConfirmState =
  | { kind: 'toggle'; user: UserRow; nextActive: boolean }
  | { kind: 'resend'; user: UserRow }
  | null;

type EditState = {
  userId: string;
  role: 'STUDENT' | 'WARDEN';
  full_name: string;
  phone: string;
  student: {
    department: string;
    course_branch: string;
    year_of_study: string;
    room_number: string;
    block_name: string;
    floor_label: string;
    assigned_warden_id: string;
    guardian_name: string;
    guardian_relation: string;
    guardian_phone: string;
    emergency_contact_phone: string;
    permanent_address: string;
    leave_balance: string;
    medical_notes: string;
    mess_plan_enabled: boolean;
  };
  warden: {
    assigned_hostel: string;
    assigned_block: string;
    assigned_floor: string;
    shift_timing: ShiftTiming;
    alternate_phone: string;
    gender: string;
    can_approve_leave: boolean;
    can_manage_guest_entries: boolean;
    can_manage_parcel_requests: boolean;
    can_access_student_records: boolean;
    can_send_notices: boolean;
    can_handle_medical_requests: boolean;
  };
};

type FieldErrors = Record<string, string>;

const YEAR_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const RELATION_OPTIONS = ['Father', 'Mother', 'Guardian', 'Brother', 'Sister', 'Other'];
const SHIFT_OPTIONS: ShiftTiming[] = ['DAY', 'NIGHT', 'BOTH'];

const roleBadgeClass = (role: string) => {
  if (role === 'ADMIN') return 'bg-lavender text-lavender-foreground';
  if (role === 'WARDEN') return 'bg-peach text-peach-foreground';
  return 'bg-mint text-mint-foreground';
};

const statusBadgeClass = (active: boolean) =>
  active ? 'bg-mint text-mint-foreground' : 'bg-blush text-blush-foreground';

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });

const escapeCsv = (value: string | number | null | undefined) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());

const makeEditState = (user: UserRow): EditState | null => {
  if (user.role !== 'STUDENT' && user.role !== 'WARDEN') {
    return null;
  }

  return {
    userId: user.id,
    role: user.role,
    full_name: user.full_name,
    phone: user.phone || '',
    student: {
      department: user.student?.department || '',
      course_branch: user.student?.course_branch || '',
      year_of_study: String(user.student?.year_of_study || 1),
      room_number: user.student?.room_allocation?.room.room_number || '',
      block_name: '',
      floor_label: '',
      assigned_warden_id: user.student?.assigned_warden?.id || '',
      guardian_name: '',
      guardian_relation: 'Father',
      guardian_phone: '',
      emergency_contact_phone: '',
      permanent_address: '',
      leave_balance: String(user.student?.leave_balance ?? 15),
      medical_notes: '',
      mess_plan_enabled: true,
    },
    warden: {
      assigned_hostel: user.warden_profile?.assigned_hostel || '',
      assigned_block: user.warden_profile?.assigned_block || '',
      assigned_floor: user.warden_profile?.assigned_floor || '',
      shift_timing: user.warden_profile?.shift_timing || 'DAY',
      alternate_phone: '',
      gender: '',
      can_approve_leave: true,
      can_manage_guest_entries: true,
      can_manage_parcel_requests: true,
      can_access_student_records: true,
      can_send_notices: true,
      can_handle_medical_requests: true,
    },
  };
};

const AdminUsersPageEnhanced = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ProvisionMode>('student');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STUDENT' | 'WARDEN' | 'ADMIN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  const [studentForm, setStudentForm] = useState({
    full_name: '',
    enrollment_no: '',
    email: '',
    phone: '',
    department: '',
    course_branch: '',
    year_of_study: '1',

    hostel_id: '',
    room_number: '',
    block_name: '',
    floor_label: '',
    hostel_joining_date: '',
    assigned_warden_id: '',
    mess_plan_enabled: true,

    guardian_name: '',
    guardian_relation: 'Father',
    guardian_phone: '',
    emergency_contact_phone: '',
    permanent_address: '',

    username: '',
    password: '',
    is_active: true,
    profile_photo_base64: '',
    id_proof_base64: '',

    leave_balance: '15',
    medical_notes: '',
  });

  const [wardenForm, setWardenForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    alternate_phone: '',
    gender: '',

    assigned_hostel: '',
    assigned_block: '',
    assigned_floor: '',
    shift_timing: 'DAY' as ShiftTiming,
    joining_date: '',
    experience_years: '',

    username: '',
    password: '',
    is_active: true,
    profile_photo_base64: '',

    can_approve_leave: true,
    can_manage_guest_entries: true,
    can_manage_parcel_requests: true,
    can_access_student_records: true,
    can_send_notices: true,
    can_handle_medical_requests: true,
  });

  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const usersQuery = useQuery({
    queryKey: ['admin-users', roleFilter, statusFilter, search, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (statusFilter !== 'ALL') params.set('is_active', statusFilter === 'ACTIVE' ? 'true' : 'false');
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('page_size', String(pageSize));

      const response = await authenticatedFetch(`/admin/users?${params.toString()}`);
      return parseJsonOrThrow<UsersResponse>(response, 'Failed to fetch users');
    },
  });

  const wardensQuery = useQuery({
    queryKey: ['warden-options'],
    queryFn: async () => {
      const response = await authenticatedFetch('/admin/users?role=WARDEN&is_active=true&page=1&page_size=250');
      return parseJsonOrThrow<UsersResponse>(response, 'Failed to load wardens');
    },
  });

  const allUsers = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.meta?.total ?? allUsers.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const wardens = useMemo(
    () => (wardensQuery.data?.users ?? []).filter((user) => user.role === 'WARDEN'),
    [wardensQuery.data],
  );

  useEffect(() => {
    const requestedMode = searchParams.get('create');
    if (requestedMode === 'student' || requestedMode === 'warden') {
      setMode(requestedMode);
    }
  }, [searchParams]);

  const switchMode = (nextMode: ProvisionMode) => {
    setMode(nextMode);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('create', nextMode);
    setSearchParams(nextParams, { replace: true });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const path = mode === 'student' ? '/admin/users/student' : '/admin/users/warden';
      const body =
        mode === 'student'
          ? {
              ...studentForm,
              year_of_study: Number(studentForm.year_of_study),
              leave_balance: Number(studentForm.leave_balance || '15'),
              assigned_warden_id: studentForm.assigned_warden_id || undefined,
              phone: studentForm.phone || undefined,
              emergency_contact_phone: studentForm.emergency_contact_phone || undefined,
              permanent_address: studentForm.permanent_address || undefined,
              username: studentForm.username || undefined,
              password: studentForm.password || undefined,
              block_name: studentForm.block_name || undefined,
              floor_label: studentForm.floor_label || undefined,
              hostel_joining_date: studentForm.hostel_joining_date
                ? new Date(studentForm.hostel_joining_date).toISOString()
                : undefined,
              medical_notes: studentForm.medical_notes || undefined,
              profile_photo_base64: studentForm.profile_photo_base64 || undefined,
              id_proof_base64: studentForm.id_proof_base64 || undefined,
            }
          : {
              ...wardenForm,
              phone: wardenForm.phone || undefined,
              alternate_phone: wardenForm.alternate_phone || undefined,
              gender: wardenForm.gender || undefined,
              username: wardenForm.username || undefined,
              password: wardenForm.password || undefined,
              assigned_block: wardenForm.assigned_block || undefined,
              assigned_floor: wardenForm.assigned_floor || undefined,
              joining_date: wardenForm.joining_date ? new Date(wardenForm.joining_date).toISOString() : undefined,
              experience_years: wardenForm.experience_years ? Number(wardenForm.experience_years) : undefined,
              profile_photo_base64: wardenForm.profile_photo_base64 || undefined,
            };

      const response = await authenticatedFetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return parseJsonOrThrow<ProvisionResponse>(response, 'Failed to create user');
    },
    onSuccess: (data) => {
      setFormError(null);
      setFormMessage(
        data.credentials_email_sent
          ? data.message
          : `${data.message}. Email delivery failed: ${data.credentials_email_error || 'Unknown reason'}`,
      );
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['warden-options'] });
    },
    onError: (error: unknown) => {
      setFormMessage(null);
      const message = error instanceof Error ? error.message : 'Unable to create user';
      setFormError(message);
      toast.error('Create account failed', { description: message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { userId: string; body: Record<string, unknown> }) => {
      const response = await authenticatedFetch(`/admin/users/${payload.userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload.body),
      });
      return parseJsonOrThrow<{ message: string }>(response, 'Failed to update user');
    },
    onSuccess: () => {
      toast.success('User updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['warden-options'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      toast.error('Update failed', { description: message });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (payload: { userId: string; isActive: boolean }) => {
      const response = await authenticatedFetch(`/admin/users/${payload.userId}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: payload.isActive }),
      });
      return parseJsonOrThrow<{ message: string }>(response, 'Failed to update user state');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User status updated');
      setConfirmState(null);
    },
  });

  const resetCredentialsMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await authenticatedFetch(`/admin/users/${userId}/reset-credentials`, {
        method: 'POST',
      });
      return parseJsonOrThrow<ProvisionResponse>(response, 'Failed to reset credentials');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Credentials reissued');
      setConfirmState(null);
    },
  });

  const handleStudentFile = async (
    event: ChangeEvent<HTMLInputElement>,
    key: 'profile_photo_base64' | 'id_proof_base64',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const encoded = await toDataUrl(file);
    setStudentForm((prev) => ({ ...prev, [key]: encoded }));
  };

  const handleWardenPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const encoded = await toDataUrl(file);
    setWardenForm((prev) => ({ ...prev, profile_photo_base64: encoded }));
  };

  const onCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);
    setFormError(null);

    const nextErrors: FieldErrors = {};
    if (mode === 'student') {
      if (!studentForm.full_name.trim()) nextErrors.full_name = 'Full name is required';
      if (!studentForm.enrollment_no.trim()) nextErrors.enrollment_no = 'Enrollment number is required';
      if (!studentForm.email.trim() || !isValidEmail(studentForm.email)) nextErrors.email = 'Valid email is required';
      if (!studentForm.department) nextErrors.department = 'Department is required';
      if (!studentForm.course_branch.trim()) nextErrors.course_branch = 'Course / Branch is required';
      if (!studentForm.hostel_id.trim()) nextErrors.hostel_id = 'Hostel ID is required';
      if (!studentForm.room_number.trim()) nextErrors.room_number = 'Room number is required';
      if (!studentForm.guardian_name.trim()) nextErrors.guardian_name = 'Guardian name is required';
      if (!studentForm.guardian_phone.trim()) nextErrors.guardian_phone = 'Guardian phone is required';
    } else {
      if (!wardenForm.full_name.trim()) nextErrors.full_name = 'Full name is required';
      if (!wardenForm.email.trim() || !isValidEmail(wardenForm.email)) nextErrors.email = 'Valid email is required';
      if (!wardenForm.phone.trim()) nextErrors.phone = 'Phone is required';
      if (!wardenForm.assigned_hostel.trim()) nextErrors.assigned_hostel = 'Assigned hostel is required';
    }

    setCreateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please fix highlighted fields before submitting.');
      return;
    }

    createMutation.mutate();
  };

  const onConfirmAction = () => {
    if (!confirmState) return;

    if (confirmState.kind === 'toggle') {
      toggleActiveMutation.mutate({
        userId: confirmState.user.id,
        isActive: confirmState.nextActive,
      });
      return;
    }

    resetCredentialsMutation.mutate(confirmState.user.id);
  };

  const beginEdit = (user: UserRow) => {
    const state = makeEditState(user);
    if (!state) return;
    setEditing(state);
  };

  const saveEdit = () => {
    if (!editing) return;

    const nextErrors: FieldErrors = {};
    if (!editing.full_name.trim()) {
      nextErrors.edit_full_name = 'Full name is required';
    }
    if (editing.role === 'STUDENT') {
      if (!editing.student.department) nextErrors.edit_department = 'Department is required';
      if (!editing.student.year_of_study) nextErrors.edit_year = 'Year is required';
    }
    if (editing.role === 'WARDEN') {
      if (!editing.warden.assigned_hostel.trim()) {
        nextErrors.edit_assigned_hostel = 'Assigned hostel is required';
      }
    }
    setEditErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const baseBody: Record<string, unknown> = {
      full_name: editing.full_name,
      phone: editing.phone || null,
    };

    if (editing.role === 'STUDENT') {
      baseBody.student = {
        department: editing.student.department,
        course_branch: editing.student.course_branch || undefined,
        year_of_study: Number(editing.student.year_of_study),
        room_number: editing.student.room_number || undefined,
        block_name: editing.student.block_name || undefined,
        floor_label: editing.student.floor_label || undefined,
        assigned_warden_id: editing.student.assigned_warden_id || null,
        guardian_name: editing.student.guardian_name || undefined,
        guardian_relation: editing.student.guardian_relation || undefined,
        guardian_phone: editing.student.guardian_phone || undefined,
        emergency_contact_phone: editing.student.emergency_contact_phone || undefined,
        permanent_address: editing.student.permanent_address || undefined,
        leave_balance: Number(editing.student.leave_balance),
        medical_notes: editing.student.medical_notes || undefined,
        mess_plan_enabled: editing.student.mess_plan_enabled,
      };
    }

    if (editing.role === 'WARDEN') {
      baseBody.warden_profile = {
        assigned_hostel: editing.warden.assigned_hostel,
        assigned_block: editing.warden.assigned_block || undefined,
        assigned_floor: editing.warden.assigned_floor || undefined,
        shift_timing: editing.warden.shift_timing,
        alternate_phone: editing.warden.alternate_phone || undefined,
        gender: editing.warden.gender || undefined,
        can_approve_leave: editing.warden.can_approve_leave,
        can_manage_guest_entries: editing.warden.can_manage_guest_entries,
        can_manage_parcel_requests: editing.warden.can_manage_parcel_requests,
        can_access_student_records: editing.warden.can_access_student_records,
        can_send_notices: editing.warden.can_send_notices,
        can_handle_medical_requests: editing.warden.can_handle_medical_requests,
      };
    }

    updateMutation.mutate({ userId: editing.userId, body: baseBody });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">User Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured onboarding for students and wardens with full hostel metadata.
        </p>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Button
            type="button"
            variant={mode === 'student' ? 'default' : 'outline'}
            className="rounded-xl"
            onClick={() => switchMode('student')}
          >
            Create Student
          </Button>
          <Button
            type="button"
            variant={mode === 'warden' ? 'default' : 'outline'}
            className="rounded-xl"
            onClick={() => switchMode('warden')}
          >
            Create Warden
          </Button>
        </div>

        <form onSubmit={onCreateUser} className="grid gap-4 md:grid-cols-2">
          {mode === 'student' ? (
            <>
              <div className="md:col-span-2 rounded-xl border border-border/70 p-4">
                <h3 className="font-semibold text-foreground">1. Basic Details</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5"><Label>Full Name *</Label><Input required value={studentForm.full_name} onChange={(e) => setStudentForm((p) => ({ ...p, full_name: e.target.value }))} className={createErrors.full_name ? 'border-destructive' : ''} />{createErrors.full_name ? <p className="text-xs text-destructive">{createErrors.full_name}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Enrollment Number *</Label><Input required value={studentForm.enrollment_no} onChange={(e) => setStudentForm((p) => ({ ...p, enrollment_no: e.target.value }))} className={createErrors.enrollment_no ? 'border-destructive' : ''} />{createErrors.enrollment_no ? <p className="text-xs text-destructive">{createErrors.enrollment_no}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Email *</Label><Input required type="email" value={studentForm.email} onChange={(e) => setStudentForm((p) => ({ ...p, email: e.target.value }))} className={createErrors.email ? 'border-destructive' : ''} />{createErrors.email ? <p className="text-xs text-destructive">{createErrors.email}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input value={studentForm.phone} onChange={(e) => setStudentForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                  <div className="space-y-1.5">
                    <Label>Department *</Label>
                    <select className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${createErrors.department ? 'border-destructive' : 'border-input'}`} required value={studentForm.department} onChange={(e) => setStudentForm((p) => ({ ...p, department: e.target.value }))}>
                      <option value="">Select</option>
                      {DEPARTMENT_OPTIONS.map((department) => <option key={department} value={department}>{department}</option>)}
                    </select>
                    {createErrors.department ? <p className="text-xs text-destructive">{createErrors.department}</p> : null}
                  </div>
                  <div className="space-y-1.5"><Label>Course / Branch *</Label><Input required value={studentForm.course_branch} onChange={(e) => setStudentForm((p) => ({ ...p, course_branch: e.target.value }))} className={createErrors.course_branch ? 'border-destructive' : ''} />{createErrors.course_branch ? <p className="text-xs text-destructive">{createErrors.course_branch}</p> : null}</div>
                  <div className="space-y-1.5">
                    <Label>Year of Study *</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required value={studentForm.year_of_study} onChange={(e) => setStudentForm((p) => ({ ...p, year_of_study: e.target.value }))}>
                      {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl border border-border/70 p-4">
                <h3 className="font-semibold text-foreground">2. Hostel Details</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5"><Label>Hostel ID *</Label><Input required value={studentForm.hostel_id} onChange={(e) => setStudentForm((p) => ({ ...p, hostel_id: e.target.value }))} className={createErrors.hostel_id ? 'border-destructive' : ''} />{createErrors.hostel_id ? <p className="text-xs text-destructive">{createErrors.hostel_id}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Room Number *</Label><Input required value={studentForm.room_number} onChange={(e) => setStudentForm((p) => ({ ...p, room_number: e.target.value }))} className={createErrors.room_number ? 'border-destructive' : ''} />{createErrors.room_number ? <p className="text-xs text-destructive">{createErrors.room_number}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Block / Wing</Label><Input value={studentForm.block_name} onChange={(e) => setStudentForm((p) => ({ ...p, block_name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Floor</Label><Input value={studentForm.floor_label} onChange={(e) => setStudentForm((p) => ({ ...p, floor_label: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Joining Date</Label><Input type="date" value={studentForm.hostel_joining_date} onChange={(e) => setStudentForm((p) => ({ ...p, hostel_joining_date: e.target.value }))} /></div>
                  <div className="space-y-1.5">
                    <Label>Assigned Warden</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={studentForm.assigned_warden_id} onChange={(e) => setStudentForm((p) => ({ ...p, assigned_warden_id: e.target.value }))}>
                      <option value="">Unassigned</option>
                      {wardens.map((warden) => <option key={warden.id} value={warden.id}>{warden.full_name}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={studentForm.mess_plan_enabled} onChange={(e) => setStudentForm((p) => ({ ...p, mess_plan_enabled: e.target.checked }))} /> Mess Plan Enabled</label>
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl border border-border/70 p-4">
                <h3 className="font-semibold text-foreground">3. Guardian Details</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5"><Label>Guardian Name *</Label><Input required value={studentForm.guardian_name} onChange={(e) => setStudentForm((p) => ({ ...p, guardian_name: e.target.value }))} className={createErrors.guardian_name ? 'border-destructive' : ''} />{createErrors.guardian_name ? <p className="text-xs text-destructive">{createErrors.guardian_name}</p> : null}</div>
                  <div className="space-y-1.5">
                    <Label>Relationship *</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required value={studentForm.guardian_relation} onChange={(e) => setStudentForm((p) => ({ ...p, guardian_relation: e.target.value }))}>
                      {RELATION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5"><Label>Guardian Phone *</Label><Input required value={studentForm.guardian_phone} onChange={(e) => setStudentForm((p) => ({ ...p, guardian_phone: e.target.value }))} className={createErrors.guardian_phone ? 'border-destructive' : ''} />{createErrors.guardian_phone ? <p className="text-xs text-destructive">{createErrors.guardian_phone}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Emergency Contact</Label><Input value={studentForm.emergency_contact_phone} onChange={(e) => setStudentForm((p) => ({ ...p, emergency_contact_phone: e.target.value }))} /></div>
                  <div className="space-y-1.5 md:col-span-2"><Label>Permanent Address</Label><Input value={studentForm.permanent_address} onChange={(e) => setStudentForm((p) => ({ ...p, permanent_address: e.target.value }))} /></div>
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl border border-border/70 p-4">
                <h3 className="font-semibold text-foreground">4. Account & System Fields</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5"><Label>Username (auto if blank)</Label><Input value={studentForm.username} onChange={(e) => setStudentForm((p) => ({ ...p, username: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Password (auto if blank)</Label><Input type="password" value={studentForm.password} onChange={(e) => setStudentForm((p) => ({ ...p, password: e.target.value }))} /></div>
                  <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={studentForm.is_active} onChange={(e) => setStudentForm((p) => ({ ...p, is_active: e.target.checked }))} /> Active Account</label>
                  <div className="space-y-1.5"><Label>Profile Photo Upload</Label><Input type="file" accept="image/*" onChange={(e) => void handleStudentFile(e, 'profile_photo_base64')} /></div>
                  <div className="space-y-1.5"><Label>ID Proof Upload</Label><Input type="file" onChange={(e) => void handleStudentFile(e, 'id_proof_base64')} /></div>
                  <div className="space-y-1.5"><Label>Leave Balance</Label><Input type="number" min={0} value={studentForm.leave_balance} onChange={(e) => setStudentForm((p) => ({ ...p, leave_balance: e.target.value }))} /></div>
                  <div className="space-y-1.5 md:col-span-2"><Label>Medical Notes</Label><Input value={studentForm.medical_notes} onChange={(e) => setStudentForm((p) => ({ ...p, medical_notes: e.target.value }))} /></div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="md:col-span-2 rounded-xl border border-border/70 p-4">
                <h3 className="font-semibold text-foreground">1. Basic Details</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5"><Label>Full Name *</Label><Input required value={wardenForm.full_name} onChange={(e) => setWardenForm((p) => ({ ...p, full_name: e.target.value }))} className={createErrors.full_name ? 'border-destructive' : ''} />{createErrors.full_name ? <p className="text-xs text-destructive">{createErrors.full_name}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Email *</Label><Input required type="email" value={wardenForm.email} onChange={(e) => setWardenForm((p) => ({ ...p, email: e.target.value }))} className={createErrors.email ? 'border-destructive' : ''} />{createErrors.email ? <p className="text-xs text-destructive">{createErrors.email}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Phone *</Label><Input required value={wardenForm.phone} onChange={(e) => setWardenForm((p) => ({ ...p, phone: e.target.value }))} className={createErrors.phone ? 'border-destructive' : ''} />{createErrors.phone ? <p className="text-xs text-destructive">{createErrors.phone}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Alternate Phone</Label><Input value={wardenForm.alternate_phone} onChange={(e) => setWardenForm((p) => ({ ...p, alternate_phone: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Gender</Label><Input value={wardenForm.gender} onChange={(e) => setWardenForm((p) => ({ ...p, gender: e.target.value }))} /></div>
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl border border-border/70 p-4">
                <h3 className="font-semibold text-foreground">2. Work Assignment</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5"><Label>Assigned Hostel *</Label><Input required value={wardenForm.assigned_hostel} onChange={(e) => setWardenForm((p) => ({ ...p, assigned_hostel: e.target.value }))} className={createErrors.assigned_hostel ? 'border-destructive' : ''} />{createErrors.assigned_hostel ? <p className="text-xs text-destructive">{createErrors.assigned_hostel}</p> : null}</div>
                  <div className="space-y-1.5"><Label>Assigned Block</Label><Input value={wardenForm.assigned_block} onChange={(e) => setWardenForm((p) => ({ ...p, assigned_block: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Assigned Floor</Label><Input value={wardenForm.assigned_floor} onChange={(e) => setWardenForm((p) => ({ ...p, assigned_floor: e.target.value }))} /></div>
                  <div className="space-y-1.5">
                    <Label>Shift Timing</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={wardenForm.shift_timing} onChange={(e) => setWardenForm((p) => ({ ...p, shift_timing: e.target.value as ShiftTiming }))}>
                      {SHIFT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5"><Label>Joining Date</Label><Input type="date" value={wardenForm.joining_date} onChange={(e) => setWardenForm((p) => ({ ...p, joining_date: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Experience (years)</Label><Input type="number" min={0} value={wardenForm.experience_years} onChange={(e) => setWardenForm((p) => ({ ...p, experience_years: e.target.value }))} /></div>
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl border border-border/70 p-4">
                <h3 className="font-semibold text-foreground">3. Account Details</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5"><Label>Username</Label><Input value={wardenForm.username} onChange={(e) => setWardenForm((p) => ({ ...p, username: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Password (auto if blank)</Label><Input type="password" value={wardenForm.password} onChange={(e) => setWardenForm((p) => ({ ...p, password: e.target.value }))} /></div>
                  <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={wardenForm.is_active} onChange={(e) => setWardenForm((p) => ({ ...p, is_active: e.target.checked }))} /> Active Account</label>
                  <div className="space-y-1.5"><Label>Profile Photo</Label><Input type="file" accept="image/*" onChange={(e) => void handleWardenPhoto(e)} /></div>
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl border border-border/70 p-4">
                <h3 className="font-semibold text-foreground">4. Permissions</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                  <label className="flex items-center gap-2" title="Allows approving or rejecting night leave requests"><input type="checkbox" checked={wardenForm.can_approve_leave} onChange={(e) => setWardenForm((p) => ({ ...p, can_approve_leave: e.target.checked }))} /> Approve/Reject Leave</label>
                  <label className="flex items-center gap-2" title="Allows managing student guest entry requests and decisions"><input type="checkbox" checked={wardenForm.can_manage_guest_entries} onChange={(e) => setWardenForm((p) => ({ ...p, can_manage_guest_entries: e.target.checked }))} /> Manage Guest Entries</label>
                  <label className="flex items-center gap-2" title="Allows handling parcel status and pickup workflows"><input type="checkbox" checked={wardenForm.can_manage_parcel_requests} onChange={(e) => setWardenForm((p) => ({ ...p, can_manage_parcel_requests: e.target.checked }))} /> Manage Parcel Requests</label>
                  <label className="flex items-center gap-2" title="Allows viewing and acting on student profiles and linked data"><input type="checkbox" checked={wardenForm.can_access_student_records} onChange={(e) => setWardenForm((p) => ({ ...p, can_access_student_records: e.target.checked }))} /> Access Student Records</label>
                  <label className="flex items-center gap-2" title="Allows publishing operational notices to residents"><input type="checkbox" checked={wardenForm.can_send_notices} onChange={(e) => setWardenForm((p) => ({ ...p, can_send_notices: e.target.checked }))} /> Send Notices</label>
                  <label className="flex items-center gap-2" title="Allows triaging and updating medical help requests"><input type="checkbox" checked={wardenForm.can_handle_medical_requests} onChange={(e) => setWardenForm((p) => ({ ...p, can_handle_medical_requests: e.target.checked }))} /> Handle Medical Requests</label>
                </div>
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <Button type="submit" className="rounded-xl" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : `Create ${mode === 'student' ? 'Student' : 'Warden'}`}
            </Button>
          </div>
        </form>

        {formMessage ? <p className="mt-3 text-sm text-primary">{formMessage}</p> : null}
        {formError ? <p className="mt-3 text-sm text-destructive">{formError}</p> : null}
      </div>

      {editing ? (
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-foreground">Edit {editing.role === 'STUDENT' ? 'Student' : 'Warden'}</h2>
            <Button variant="outline" className="rounded-lg" onClick={() => setEditing(null)}>Close</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={editing.full_name} onChange={(e) => setEditing((p) => p ? ({ ...p, full_name: e.target.value }) : p)} className={editErrors.edit_full_name ? 'border-destructive' : ''} />{editErrors.edit_full_name ? <p className="text-xs text-destructive">{editErrors.edit_full_name}</p> : null}</div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={editing.phone} onChange={(e) => setEditing((p) => p ? ({ ...p, phone: e.target.value }) : p)} /></div>

            {editing.role === 'STUDENT' ? (
              <>
                <div className="space-y-1.5"><Label>Department</Label>
                  <select className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${editErrors.edit_department ? 'border-destructive' : 'border-input'}`} value={editing.student.department} onChange={(e) => setEditing((p) => p ? ({ ...p, student: { ...p.student, department: e.target.value } }) : p)}>
                    {DEPARTMENT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {editErrors.edit_department ? <p className="text-xs text-destructive">{editErrors.edit_department}</p> : null}
                </div>
                <div className="space-y-1.5"><Label>Course Branch</Label><Input value={editing.student.course_branch} onChange={(e) => setEditing((p) => p ? ({ ...p, student: { ...p.student, course_branch: e.target.value } }) : p)} /></div>
                <div className="space-y-1.5"><Label>Year</Label><Input type="number" min={1} max={8} value={editing.student.year_of_study} onChange={(e) => setEditing((p) => p ? ({ ...p, student: { ...p.student, year_of_study: e.target.value } }) : p)} className={editErrors.edit_year ? 'border-destructive' : ''} />{editErrors.edit_year ? <p className="text-xs text-destructive">{editErrors.edit_year}</p> : null}</div>
                <div className="space-y-1.5"><Label>Room Number</Label><Input value={editing.student.room_number} onChange={(e) => setEditing((p) => p ? ({ ...p, student: { ...p.student, room_number: e.target.value } }) : p)} /></div>
                <div className="space-y-1.5"><Label>Assigned Warden</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editing.student.assigned_warden_id} onChange={(e) => setEditing((p) => p ? ({ ...p, student: { ...p.student, assigned_warden_id: e.target.value } }) : p)}>
                    <option value="">Unassigned</option>
                    {wardens.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Leave Balance</Label><Input type="number" min={0} value={editing.student.leave_balance} onChange={(e) => setEditing((p) => p ? ({ ...p, student: { ...p.student, leave_balance: e.target.value } }) : p)} /></div>
                <label className="mt-7 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={editing.student.mess_plan_enabled} onChange={(e) => setEditing((p) => p ? ({ ...p, student: { ...p.student, mess_plan_enabled: e.target.checked } }) : p)} /> Mess Plan Enabled</label>
              </>
            ) : (
              <>
                <div className="space-y-1.5"><Label>Assigned Hostel</Label><Input value={editing.warden.assigned_hostel} onChange={(e) => setEditing((p) => p ? ({ ...p, warden: { ...p.warden, assigned_hostel: e.target.value } }) : p)} className={editErrors.edit_assigned_hostel ? 'border-destructive' : ''} />{editErrors.edit_assigned_hostel ? <p className="text-xs text-destructive">{editErrors.edit_assigned_hostel}</p> : null}</div>
                <div className="space-y-1.5"><Label>Assigned Block</Label><Input value={editing.warden.assigned_block} onChange={(e) => setEditing((p) => p ? ({ ...p, warden: { ...p.warden, assigned_block: e.target.value } }) : p)} /></div>
                <div className="space-y-1.5"><Label>Assigned Floor</Label><Input value={editing.warden.assigned_floor} onChange={(e) => setEditing((p) => p ? ({ ...p, warden: { ...p.warden, assigned_floor: e.target.value } }) : p)} /></div>
                <div className="space-y-1.5"><Label>Shift</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editing.warden.shift_timing} onChange={(e) => setEditing((p) => p ? ({ ...p, warden: { ...p.warden, shift_timing: e.target.value as ShiftTiming } }) : p)}>
                    {SHIFT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <label className="mt-7 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={editing.warden.can_approve_leave} onChange={(e) => setEditing((p) => p ? ({ ...p, warden: { ...p.warden, can_approve_leave: e.target.checked } }) : p)} /> Approve Leave</label>
                <label className="mt-7 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={editing.warden.can_manage_guest_entries} onChange={(e) => setEditing((p) => p ? ({ ...p, warden: { ...p.warden, can_manage_guest_entries: e.target.checked } }) : p)} /> Guest Entries</label>
              </>
            )}
          </div>

          <div className="mt-4">
            <Button className="rounded-xl" onClick={saveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl text-foreground">All users</h2>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users" className="max-w-xs" />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'ALL' | 'STUDENT' | 'WARDEN' | 'ADMIN')}>
            <option value="ALL">All Roles</option>
            <option value="STUDENT">Student</option>
            <option value="WARDEN">Warden</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}>
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => {
              const headers = ['Name', 'Email', 'Role', 'Status', 'Hostel', 'Room', 'Warden', 'Last Login'];
              const lines = allUsers.map((user) => [
                escapeCsv(user.full_name),
                escapeCsv(user.email),
                escapeCsv(user.role),
                escapeCsv(user.is_active ? 'ACTIVE' : 'INACTIVE'),
                escapeCsv(user.student?.hostel_id || ''),
                escapeCsv(user.student?.room_allocation?.room.room_number || ''),
                escapeCsv(user.student?.assigned_warden?.full_name || ''),
                escapeCsv(user.last_login_at ? new Date(user.last_login_at).toISOString() : ''),
              ].join(','));

              const csv = [headers.join(','), ...lines].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `users-page-${page}.csv`;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
          <Badge variant="outline" className="rounded-full">Page {page} of {totalPages}</Badge>
        </div>

        {usersQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
        {usersQuery.error ? <p className="text-sm text-destructive">{(usersQuery.error as Error).message}</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted-foreground">Name</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Role</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Assignment</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left text-muted-foreground">System</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((user) => (
                <tr key={user.id} className="border-b border-border/60">
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-3 py-3"><Badge className={`rounded-full text-xs ${roleBadgeClass(user.role)}`}>{user.role}</Badge></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {user.role === 'STUDENT' ? (
                      <>
                        <p>Hostel: {user.student?.hostel_id || '--'} | Room: {user.student?.room_allocation?.room.room_number || '--'}</p>
                        <p>Warden: {user.student?.assigned_warden?.full_name || 'Unassigned'}</p>
                      </>
                    ) : user.role === 'WARDEN' ? (
                      <>
                        <p>ID: {user.warden_profile?.warden_id || '--'}</p>
                        <p>{user.warden_profile?.assigned_hostel || '--'} / {user.warden_profile?.assigned_block || '--'} / {user.warden_profile?.assigned_floor || '--'}</p>
                        <p>Students: {user._count?.assigned_students || 0}</p>
                      </>
                    ) : (
                      <p>Platform Admin</p>
                    )}
                  </td>
                  <td className="px-3 py-3"><Badge className={`rounded-full text-xs ${statusBadgeClass(user.is_active)}`}>{user.is_active ? 'ACTIVE' : 'INACTIVE'}</Badge></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    <p>First Login: {user.first_login ? 'YES' : 'NO'}</p>
                    <p>Last Login: {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '--'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {user.role !== 'ADMIN' ? (
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => beginEdit(user)}>
                          Edit
                        </Button>
                      ) : null}
                      {user.role !== 'ADMIN' ? (
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setConfirmState({ kind: 'resend', user })}>
                          Resend credentials
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setConfirmState({ kind: 'toggle', user, nextActive: !user.is_active })}>
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {!usersQuery.isLoading && allUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No users found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {allUsers.length} records out of {total}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-lg" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
            <Button variant="outline" className="rounded-lg" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>Next</Button>
          </div>
        </div>
      </div>

      <AlertDialog open={Boolean(confirmState)} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.kind === 'toggle' ? `${confirmState.nextActive ? 'Activate' : 'Deactivate'} user` : 'Resend credentials'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.kind === 'toggle'
                ? `Are you sure you want to ${confirmState.nextActive ? 'activate' : 'deactivate'} ${confirmState.user.full_name}?`
                : `Resending credentials for ${confirmState?.user.full_name} will generate a new temporary password.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleActiveMutation.isPending || resetCredentialsMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmAction} disabled={toggleActiveMutation.isPending || resetCredentialsMutation.isPending}>
              {toggleActiveMutation.isPending || resetCredentialsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPageEnhanced;
