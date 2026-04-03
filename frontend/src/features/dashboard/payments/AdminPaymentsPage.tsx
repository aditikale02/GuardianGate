import { CheckCircle2, CreditCard, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AdminPaymentsResponse = {
  filters: {
    search: string;
    room: string;
    department: string;
    status: string;
    fee_type: string;
  };
  summary: {
    total_collected: number;
    total_pending: number;
    total_overdue: number;
    total_students_paid: number;
    total_students_pending: number;
    total_students_overdue: number;
  };
  rows: Array<{
    id: string;
    student_id: string;
    student: string;
    enrollment_no: string;
    hostel: string;
    floor: string;
    room: string;
    department: string;
    active: boolean;
    fee_type: string;
    amount: number;
    paid_amount: number;
    pending_amount: number;
    payment_date: string | null;
    due_date: string;
    remarks: string | null;
    updated_by: string | null;
    last_updated: string;
    status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
    history: Array<{
      id: string;
      amount_paid: number;
      payment_date: string;
      payment_mode: string | null;
      remarks: string | null;
      recorded_by: string | null;
    }>;
  }>;
};

type UpdatePaymentResponse = {
  message: string;
  row: {
    id: string;
  };
};

const statusColors: Record<string, string> = { PAID: 'bg-mint text-mint-foreground', PARTIAL: 'bg-lavender text-lavender-foreground', PENDING: 'bg-peach text-peach-foreground', OVERDUE: 'bg-destructive/15 text-destructive' };

const formatInr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const calculateStatus = (totalAmount: number, paidAmount: number, dueDateIso: string): 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' => {
  if (paidAmount >= totalAmount - 0.0001) return 'PAID';
  if (new Date(dueDateIso).getTime() < Date.now()) return 'OVERDUE';
  if (paidAmount > 0.0001) return 'PARTIAL';
  return 'PENDING';
};

const AdminPaymentsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE'>('ALL');
  const [department, setDepartment] = useState<string>('ALL');
  const [feeType, setFeeType] = useState<string>('ALL');
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentsResponse['rows'][number] | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [paidAmountInput, setPaidAmountInput] = useState('0');
  const [statusInput, setStatusInput] = useState<'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE'>('PENDING');
  const [remarksInput, setRemarksInput] = useState('');
  const [paymentModeInput, setPaymentModeInput] = useState('OFFLINE');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['campus-payments-admin', search, status, department, feeType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'ALL') params.set('status', status);
      if (department !== 'ALL') params.set('department', department);
      if (feeType !== 'ALL') params.set('fee_type', feeType);
      const response = await authenticatedFetch(`/campus/payments/admin?${params.toString()}`);
      return parseJsonOrThrow<AdminPaymentsResponse>(response, 'Failed to load payments');
    },
  });

  const feeTypeOptions = useMemo(() => {
    const values = Array.from(new Set((data?.rows || []).map((row) => row.fee_type))).sort((a, b) => a.localeCompare(b));
    return values;
  }, [data?.rows]);

  const departmentOptions = useMemo(() => {
    const values = Array.from(new Set((data?.rows || []).map((row) => row.department))).sort((a, b) => a.localeCompare(b));
    return values;
  }, [data?.rows]);

  const payments = data?.rows || [];

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      feeRecordId: string;
      paidAmount: number;
      status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
      remarks?: string;
      paymentMode?: string;
    }) => {
      const response = await authenticatedFetch(`/campus/payments/admin/${payload.feeRecordId}/update`, {
        method: 'POST',
        body: JSON.stringify({
          paid_amount: payload.paidAmount,
          status: payload.status,
          remarks: payload.remarks || undefined,
          payment_mode: payload.paymentMode || undefined,
        }),
      });
      return parseJsonOrThrow<UpdatePaymentResponse>(response, 'Failed to update payment');
    },
    onSuccess: () => {
      setFormError(null);
      setIsUpdateDialogOpen(false);
      setSelectedPayment(null);
      queryClient.invalidateQueries({ queryKey: ['campus-payments-admin'] });
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : 'Failed to update payment');
    },
  });

  const openUpdateDialog = (payment: AdminPaymentsResponse['rows'][number], markAsPaid = false) => {
    const initialPaidAmount = markAsPaid ? payment.amount : payment.paid_amount;
    const computedStatus = calculateStatus(payment.amount, initialPaidAmount, payment.due_date);
    setSelectedPayment(payment);
    setPaidAmountInput(initialPaidAmount.toFixed(2));
    setStatusInput(computedStatus);
    setRemarksInput(markAsPaid ? 'Marked fully paid by admin' : payment.remarks || '');
    setPaymentModeInput(markAsPaid ? 'OFFLINE' : 'OFFLINE');
    setFormError(null);
    setIsUpdateDialogOpen(true);
  };

  const submitUpdate = () => {
    if (!selectedPayment) return;

    const paidAmount = Number(paidAmountInput);
    if (Number.isNaN(paidAmount)) {
      setFormError('Paid amount must be a valid number');
      return;
    }
    if (paidAmount < 0) {
      setFormError('Paid amount cannot be negative');
      return;
    }
    if (paidAmount > selectedPayment.amount + 0.0001) {
      setFormError('Paid amount cannot exceed total fee');
      return;
    }

    const computedStatus = calculateStatus(selectedPayment.amount, paidAmount, selectedPayment.due_date);
    if (statusInput !== computedStatus) {
      setFormError(`Status must be ${computedStatus} for the entered paid amount and due date`);
      return;
    }

    updateMutation.mutate({
      feeRecordId: selectedPayment.id,
      paidAmount,
      status: statusInput,
      remarks: remarksInput,
      paymentMode: paymentModeInput,
    });
  };

  const pendingAmountPreview = useMemo(() => {
    if (!selectedPayment) return 0;
    const paid = Number(paidAmountInput);
    if (Number.isNaN(paid)) return selectedPayment.pending_amount;
    return Math.max(0, Number((selectedPayment.amount - paid).toFixed(2)));
  }, [selectedPayment, paidAmountInput]);

  const computedStatusPreview = useMemo(() => {
    if (!selectedPayment) return 'PENDING' as const;
    const paid = Number(paidAmountInput);
    if (Number.isNaN(paid)) return selectedPayment.status;
    return calculateStatus(selectedPayment.amount, paid, selectedPayment.due_date);
  }, [selectedPayment, paidAmountInput]);

  return (
  <div className="space-y-6 max-w-4xl">
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">Payment Management</h1>
      <p className="text-sm text-muted-foreground mt-1">Track student fee payments</p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="rounded-2xl bg-mint p-4 shadow-card text-center">
        <p className="font-display text-xl font-bold text-foreground">{formatInr(data?.summary.total_collected || 0)}</p>
        <p className="text-xs text-muted-foreground">Total Collected</p>
      </div>
      <div className="rounded-2xl bg-peach p-4 shadow-card text-center">
        <p className="font-display text-xl font-bold text-foreground">{formatInr(data?.summary.total_pending || 0)}</p>
        <p className="text-xs text-muted-foreground">Pending</p>
      </div>
      <div className="rounded-2xl bg-destructive/10 p-4 shadow-card text-center">
        <p className="font-display text-xl font-bold text-foreground">{formatInr(data?.summary.total_overdue || 0)}</p>
        <p className="text-xs text-muted-foreground">Overdue</p>
      </div>
      <div className="rounded-2xl bg-lavender p-4 shadow-card text-center">
        <p className="font-display text-xl font-bold text-foreground">{data?.summary.total_students_paid || 0}</p>
        <p className="text-xs text-muted-foreground">Students Paid</p>
      </div>
      <div className="rounded-2xl bg-muted p-4 shadow-card text-center">
        <p className="font-display text-xl font-bold text-foreground">{data?.summary.total_students_pending || 0}</p>
        <p className="text-xs text-muted-foreground">Students Pending</p>
      </div>
    </div>

    <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 max-w-md">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input placeholder="Search name, enrollment, hostel, floor, room..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <select className="h-9 rounded-xl border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE')}>
          <option value="ALL">All Status</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PENDING">Pending</option>
          <option value="OVERDUE">Overdue</option>
        </select>
        <select className="h-9 rounded-xl border border-input bg-background px-3 text-sm" value={department} onChange={(event) => setDepartment(event.target.value)}>
          <option value="ALL">All Departments</option>
          {departmentOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select className="h-9 rounded-xl border border-input bg-background px-3 text-sm" value={feeType} onChange={(event) => setFeeType(event.target.value)}>
          <option value="ALL">All Fee Types</option>
          {feeTypeOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading payments...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {payments.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-4 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lavender p-2.5"><CreditCard className="h-5 w-5 text-lavender-foreground" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">{p.student} <span className="text-xs text-muted-foreground">({p.student_id})</span></p>
              <p className="text-xs text-muted-foreground">{p.enrollment_no} • {p.department} • {p.fee_type}</p>
              <p className="text-xs text-muted-foreground">{p.hostel} • {p.floor} • Room {p.room}</p>
              <p className="text-xs text-muted-foreground">Total: {formatInr(p.amount)} | Paid: {formatInr(p.paid_amount)} | Pending: {formatInr(p.pending_amount)}</p>
              <p className="text-xs text-muted-foreground">Due: {new Date(p.due_date).toLocaleDateString()} {p.payment_date ? `| Last payment: ${new Date(p.payment_date).toLocaleDateString()}` : ''}</p>
              <p className="text-xs text-muted-foreground">Updated by: {p.updated_by || 'Admin'} | Last updated: {new Date(p.last_updated).toLocaleDateString()}</p>
              {p.remarks ? <p className="text-xs text-muted-foreground">Remarks: {p.remarks}</p> : null}
              {p.history.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  History: {p.history.slice(0, 2).map((item) => `${new Date(item.payment_date).toLocaleDateString()} (${formatInr(item.amount_paid)})`).join(' • ')}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={`rounded-full text-[10px] ${statusColors[p.status]}`}>{p.status.toLowerCase()}</Badge>
            <Button size="sm" className="rounded-lg" onClick={() => openUpdateDialog(p, true)}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Mark as Paid
            </Button>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openUpdateDialog(p)}>
              Update Status
            </Button>
          </div>
        </motion.div>
      ))}
      {!isLoading && payments.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No payment records found.</div> : null}
    </div>

    <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Update Payment</DialogTitle>
          <DialogDescription>
            Update paid amount, pending amount and status for the selected student.
          </DialogDescription>
        </DialogHeader>

        {selectedPayment ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted p-3 text-sm">
              <p className="font-semibold text-foreground">{selectedPayment.student} ({selectedPayment.student_id})</p>
              <p className="text-muted-foreground">{selectedPayment.hostel} • {selectedPayment.floor} • Room {selectedPayment.room}</p>
              <p className="text-muted-foreground">{selectedPayment.fee_type} • Total Fee: {formatInr(selectedPayment.amount)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Paid Amount</p>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={paidAmountInput}
                  onChange={(event) => setPaidAmountInput(event.target.value)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Pending Amount</p>
                <Input value={pendingAmountPreview.toFixed(2)} readOnly />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Payment Status</p>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={statusInput}
                  onChange={(event) => setStatusInput(event.target.value as 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE')}
                >
                  <option value="PAID">Paid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PENDING">Pending</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">Auto-calculated: {computedStatusPreview.toLowerCase()}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Payment Mode</p>
                <Input value={paymentModeInput} onChange={(event) => setPaymentModeInput(event.target.value)} placeholder="OFFLINE / UPI / BANK" />
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">Remarks</p>
              <Input value={remarksInput} onChange={(event) => setRemarksInput(event.target.value)} placeholder="Optional update notes" />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            {selectedPayment.history.length > 0 ? (
              <div className="rounded-xl bg-card p-3 shadow-card">
                <p className="text-xs font-semibold text-foreground">Recent Update History</p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {selectedPayment.history.slice(0, 5).map((item) => (
                    <p key={item.id}>
                      {new Date(item.payment_date).toLocaleString()} • {formatInr(item.amount_paid)} • {item.payment_mode || 'N/A'} • {item.recorded_by || 'Admin'}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)} disabled={updateMutation.isPending}>Cancel</Button>
          <Button onClick={submitUpdate} disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Updating...' : 'Save/Update'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  );
};

export default AdminPaymentsPage;
