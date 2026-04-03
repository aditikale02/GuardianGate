import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: 'peach' | 'blush' | 'lavender' | 'mint';
}

const variantStyles = {
  peach: 'bg-peach text-peach-foreground',
  blush: 'bg-blush text-blush-foreground',
  lavender: 'bg-lavender text-lavender-foreground',
  mint: 'bg-mint text-mint-foreground',
};

const iconBg = {
  peach: 'bg-peach-foreground/10',
  blush: 'bg-blush-foreground/10',
  lavender: 'bg-lavender-foreground/10',
  mint: 'bg-mint-foreground/10',
};

const MetricCard = ({ title, value, icon: Icon, trend, variant = 'peach' }: MetricCardProps) => (
  <motion.div
    whileHover={{ y: -4, boxShadow: 'var(--shadow-hover)' }}
    transition={{ duration: 0.2 }}
    className={`rounded-2xl p-6 ${variantStyles[variant]} shadow-card`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium opacity-70">{title}</p>
        <p className="mt-2 font-display text-3xl font-bold">{value}</p>
        {trend && <p className="mt-1 text-xs font-medium opacity-60">{trend}</p>}
      </div>
      <div className={`rounded-xl p-3 ${iconBg[variant]}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </motion.div>
);

export default MetricCard;
