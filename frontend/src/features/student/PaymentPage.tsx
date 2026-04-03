import { motion } from 'framer-motion';
import { CreditCard, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type MyPaymentsResponse = {
  summary: {
    total: number;
    paid: number;
    pending: number;
    due_date: string | null;
  };
  rows: Array<{
    id: string;
    fee_type: string;
    amount: number;
    due_date: string;
    status: 'PAID' | 'PENDING' | 'OVERDUE';
  }>;
};

const statusConfig: Record<string, { bg: string; icon: typeof CheckCircle }> = {
  PAID: { bg: 'bg-mint text-mint-foreground', icon: CheckCircle },
  PENDING: { bg: 'bg-peach text-peach-foreground', icon: Clock },
  OVERDUE: { bg: 'bg-destructive/15 text-destructive', icon: AlertCircle },
};

const formatInr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const PaymentPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['campus-payments-student'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/payments/my');
      return parseJsonOrThrow<MyPaymentsResponse>(response, 'Failed to load payment history');
    },
  });

  const paymentSummary = data?.summary || { total: 0, paid: 0, pending: 0, due_date: null };
  const payments = data?.rows || [];

  return (
  <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">Payments</h1>
      <p className="text-xs text-muted-foreground mt-0.5">Track fees & payment history</p>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading payments...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    {/* Summary cards */}
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-mint p-4 shadow-card">
        <p className="text-xs text-mint-foreground font-medium">Total Paid</p>
        <p className="font-display text-xl font-bold text-foreground mt-1">{formatInr(paymentSummary.paid)}</p>
      </div>
      <div className="rounded-2xl bg-peach p-4 shadow-card">
        <p className="text-xs text-peach-foreground font-medium">Pending</p>
        <p className="font-display text-xl font-bold text-foreground mt-1">{formatInr(paymentSummary.pending)}</p>
      </div>
    </div>

    {/* Due reminder */}
    <div className="rounded-2xl bg-blush/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Next payment due</p>
          <p className="text-xs text-muted-foreground">{paymentSummary.due_date ? new Date(paymentSummary.due_date).toLocaleDateString() : 'No dues'} • {formatInr(paymentSummary.pending)}</p>
        </div>
        <button className="rounded-xl bg-primary text-primary-foreground text-xs font-semibold px-4 py-2">Pay Now</button>
      </div>
    </div>

    {/* Payment history */}
    <div className="space-y-3">
      <h3 className="font-display font-semibold text-sm text-foreground">Payment History</h3>
      {payments.map((p, i) => {
        const cfg = statusConfig[p.status];
        return (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-lavender p-2.5">
                  <CreditCard className="h-5 w-5 text-lavender-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.fee_type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.due_date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{formatInr(p.amount)}</p>
                <Badge className={`rounded-full text-[10px] mt-1 ${cfg.bg}`}>{p.status.toLowerCase()}</Badge>
              </div>
            </div>
            {p.status === 'PAID' && (
              <button className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
                <Download className="h-3 w-3" /> Download Receipt
              </button>
            )}
          </motion.div>
        );
      })}
      {!isLoading && payments.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No payment history found.</div> : null}
    </div>
  </div>
  );
};

export default PaymentPage;
