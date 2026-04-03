import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  student?: {
    hostel_id: string;
    enrollment_no: string;
    department: string;
    year_of_study: number;
  } | null;
};

type UsersResponse = {
  users: UserRow[];
};

type ProvisionResponse = {
  message: string;
  credentials_email_sent: boolean;
  credentials_email_error?: string;
  credentials_email_status?: string;
  credentials_emailed_at?: string | null;
};

type ProvisionMode = 'student' | 'warden';
type ConfirmState =
  | { kind: 'toggle'; user: UserRow; nextActive: boolean }
  | { kind: 'resend'; user: UserRow }
  | null;

const PAGE_SIZE = 8;

const roleBadgeClass = (role: string) => {
  if (role === 'ADMIN') return 'bg-lavender text-lavender-foreground';
  if (role === 'WARDEN') return 'bg-peach text-peach-foreground';
  return 'bg-mint text-mint-foreground';
};

const statusBadgeClass = (active: boolean) => {
  return active ? 'bg-mint text-mint-foreground' : 'bg-blush text-blush-foreground';
};

const emailStatusBadgeClass = (status?: string | null) => {
  if (status === 'SENT') return 'bg-mint text-mint-foreground';
  if (status === 'FAILED') return 'bg-blush text-blush-foreground';
  return 'bg-muted text-muted-foreground';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString();
};

const AdminUsersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ProvisionMode>('student');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const [studentForm, setStudentForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    hostel_id: '',
    enrollment_no: '',
    department: '',
    year_of_study: '1',
  });

  const [wardenForm, setWardenForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    username: '',
  });

  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await authenticatedFetch('/admin/users');
      return parseJsonOrThrow<UsersResponse>(response, 'Failed to fetch users');
    },
  });

  const users = useMemo(() => {
    const rows = usersQuery.data?.users ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((user) => {
      const hostelId = user.student?.hostel_id ?? '';
      return (
        user.full_name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q) ||
        hostelId.toLowerCase().includes(q)
      );
    });
  }, [usersQuery.data, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

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

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const normalizedPage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (normalizedPage - 1) * PAGE_SIZE;
    return users.slice(start, start + PAGE_SIZE);
  }, [normalizedPage, users]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const path = mode === 'student' ? '/admin/users/student' : '/admin/users/warden';
      const body =
        mode === 'student'
          ? {
              ...studentForm,
              year_of_study: Number(studentForm.year_of_study),
              phone: studentForm.phone || undefined,
            }
          : {
              ...wardenForm,
              phone: wardenForm.phone || undefined,
              username: wardenForm.username || undefined,
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
      toast.success(data.message, {
        description: data.credentials_email_sent
          ? 'Credentials sent successfully.'
          : `Account created, but email failed: ${data.credentials_email_error || 'Unknown reason'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

      if (mode === 'student') {
        setStudentForm({
          full_name: '',
          email: '',
          phone: '',
          hostel_id: '',
          enrollment_no: '',
          department: '',
          year_of_study: '1',
        });
      } else {
        setWardenForm({
          full_name: '',
          email: '',
          phone: '',
          username: '',
        });
      }
    },
    onError: (error: unknown) => {
      setFormMessage(null);
      const message = error instanceof Error ? error.message : 'Unable to create user';
      setFormError(message);
      toast.error('Create account failed', { description: message });
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
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update user state';
      toast.error('Status update failed', { description: message });
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
      toast.success('Credentials reissued', {
        description: 'A new temporary password has been generated and emailed.',
      });
      setConfirmState(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to resend credentials';
      toast.error('Resend failed', { description: message });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (payload: { userId: string; full_name?: string; phone?: string | null }) => {
      const response = await authenticatedFetch(`/admin/users/${payload.userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      return parseJsonOrThrow<{ message: string }>(response, 'Failed to update user');
    },
    onSuccess: () => {
      setEditingUserId(null);
      setEditFullName('');
      setEditPhone('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User details updated');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      toast.error('Update failed', { description: message });
    },
  });

  const onCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);
    setFormError(null);
    createMutation.mutate();
  };

  const startEditing = (user: UserRow) => {
    setEditingUserId(user.id);
    setEditFullName(user.full_name);
    setEditPhone(user.phone || '');
  };

  const submitUpdate = (userId: string) => {
    updateUserMutation.mutate({
      userId,
      full_name: editFullName.trim() || undefined,
      phone: editPhone.trim() ? editPhone.trim() : null,
    });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">User Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create and manage student and warden accounts.</p>
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

        <form onSubmit={onCreateUser} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={mode === 'student' ? studentForm.full_name : wardenForm.full_name}
              onChange={(event) =>
                mode === 'student'
                  ? setStudentForm((prev) => ({ ...prev, full_name: event.target.value }))
                  : setWardenForm((prev) => ({ ...prev, full_name: event.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={mode === 'student' ? studentForm.email : wardenForm.email}
              onChange={(event) =>
                mode === 'student'
                  ? setStudentForm((prev) => ({ ...prev, email: event.target.value }))
                  : setWardenForm((prev) => ({ ...prev, email: event.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              value={mode === 'student' ? studentForm.phone : wardenForm.phone}
              onChange={(event) =>
                mode === 'student'
                  ? setStudentForm((prev) => ({ ...prev, phone: event.target.value }))
                  : setWardenForm((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </div>

          {mode === 'student' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="hostel_id">Hostel ID</Label>
                <Input
                  id="hostel_id"
                  value={studentForm.hostel_id}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, hostel_id: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="enrollment_no">Enrollment No</Label>
                <Input
                  id="enrollment_no"
                  value={studentForm.enrollment_no}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, enrollment_no: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <select
                  id="department"
                  value={studentForm.department}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, department: event.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  required
                >
                  <option value="">Select department</option>
                  {DEPARTMENT_OPTIONS.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="year">Year of study</Label>
                <Input
                  id="year"
                  type="number"
                  min={1}
                  max={8}
                  value={studentForm.year_of_study}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, year_of_study: event.target.value }))}
                  required
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="username">Username (optional)</Label>
              <Input
                id="username"
                value={wardenForm.username}
                onChange={(event) => setWardenForm((prev) => ({ ...prev, username: event.target.value }))}
              />
            </div>
          )}

          <div className="md:col-span-2">
            <Button type="submit" className="rounded-xl" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create account'}
            </Button>
          </div>
        </form>

        {formMessage ? <p className="mt-3 text-sm text-primary">{formMessage}</p> : null}
        {formError ? <p className="mt-3 text-sm text-destructive">{formError}</p> : null}
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-foreground">All users</h2>
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, role, hostel"
              className="max-w-sm"
            />
            <Badge variant="outline" className="rounded-full">Page {normalizedPage} of {totalPages}</Badge>
          </div>
        </div>

        {usersQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
        {usersQuery.error ? (
          <p className="text-sm text-destructive">{(usersQuery.error as Error).message}</p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1140px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted-foreground">Name</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Email</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Role</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Hostel ID</th>
                <th className="px-3 py-2 text-left text-muted-foreground">First login</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Email status</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Last sent</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="border-b border-border/60">
                  <td className="px-3 py-3">
                    {editingUserId === user.id ? (
                      <Input value={editFullName} onChange={(event) => setEditFullName(event.target.value)} />
                    ) : (
                      <div>
                        <p className="font-medium text-foreground">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-3 py-3">
                    <Badge className={`rounded-full text-xs ${roleBadgeClass(user.role)}`}>{user.role}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Badge className={`rounded-full text-xs ${statusBadgeClass(user.is_active)}`}>
                      {user.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{user.student?.hostel_id ?? '--'}</td>
                  <td className="px-3 py-3 text-muted-foreground">{user.first_login ? 'YES' : 'NO'}</td>
                  <td className="px-3 py-3">
                    <Badge className={`rounded-full text-xs ${emailStatusBadgeClass(user.credentials_email_status)}`}>
                      {user.credentials_email_status || 'PENDING'}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDateTime(user.credentials_emailed_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {editingUserId === user.id ? (
                        <>
                          <Input
                            value={editPhone}
                            onChange={(event) => setEditPhone(event.target.value)}
                            placeholder="Phone"
                            className="w-40"
                          />
                          <Button
                            size="sm"
                            className="rounded-lg"
                            disabled={updateUserMutation.isPending}
                            onClick={() => submitUpdate(user.id)}
                          >
                            {updateUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            onClick={() => setEditingUserId(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => startEditing(user)}>
                            Edit
                          </Button>
                          {user.role !== 'ADMIN' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              disabled={resetCredentialsMutation.isPending}
                              onClick={() => setConfirmState({ kind: 'resend', user })}
                            >
                              {resetCredentialsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Resend credentials
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            disabled={toggleActiveMutation.isPending}
                            onClick={() =>
                              setConfirmState({ kind: 'toggle', user, nextActive: !user.is_active })
                            }
                          >
                            {toggleActiveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!usersQuery.isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(normalizedPage - 1) * PAGE_SIZE + 1} to {Math.min(normalizedPage * PAGE_SIZE, users.length)} of {users.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-lg"
              disabled={normalizedPage <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="rounded-lg"
              disabled={normalizedPage >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={Boolean(confirmState)} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState?.kind === 'toggle'
                ? `${confirmState.nextActive ? 'Activate' : 'Deactivate'} user`
                : 'Resend credentials'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState?.kind === 'toggle'
                ? `Are you sure you want to ${confirmState.nextActive ? 'activate' : 'deactivate'} ${confirmState.user.full_name}?`
                : `Resending credentials for ${confirmState?.user.full_name} will generate a new temporary password.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleActiveMutation.isPending || resetCredentialsMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmAction}
              disabled={toggleActiveMutation.isPending || resetCredentialsMutation.isPending}
            >
              {toggleActiveMutation.isPending || resetCredentialsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
