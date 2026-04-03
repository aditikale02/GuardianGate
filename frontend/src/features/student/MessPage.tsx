import { motion } from 'framer-motion';
import { UtensilsCrossed, Star, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';
import { useMemo, useState } from 'react';

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type MealKey = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

type TimetableShape = Record<DayKey, Record<MealKey, string[]>>;

type TimetableResponse = {
  week_start_date: string;
  structured_menu: TimetableShape;
  image_url?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
};

const dayLabels: Array<{ key: DayKey; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const mealKeys: MealKey[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

const EMPTY_MENUS: MenusResponse['rows'] = [];

type MenusResponse = {
  rows: Array<{
    id: string;
    meal_type: string;
    items: string[];
  }>;
};

const MessPage = () => {
  const queryClient = useQueryClient();
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const timetableQuery = useQuery({
    queryKey: ['student-mess-timetable'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/mess/timetable');
      return parseJsonOrThrow<TimetableResponse>(response, 'Failed to load weekly timetable');
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-mess-menu'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/mess/menus/today');
      return parseJsonOrThrow<MenusResponse>(response, 'Failed to load menu');
    },
  });

  const menus = useMemo(() => data?.rows ?? EMPTY_MENUS, [data?.rows]);

  const structuredMenu = timetableQuery.data?.structured_menu;

  const submitRating = useMutation({
    mutationFn: async (payload: { menu_id: string; rating: number; comment?: string }) => {
      const response = await authenticatedFetch('/workflows/mess/ratings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await parseJsonOrThrow(response, 'Failed to submit rating');
    },
    onSuccess: () => {
      setSelectedRating(0);
      setFeedback('');
      queryClient.invalidateQueries({ queryKey: ['student-mess-menu'] });
    },
  });

  return (
  <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">Mess & Food</h1>
      <p className="text-xs text-muted-foreground mt-0.5">Read-only weekly timetable and food ratings</p>
    </div>

    {timetableQuery.isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading weekly timetable...</div> : null}
    {timetableQuery.error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(timetableQuery.error as Error).message}</div> : null}

    <div className="rounded-2xl bg-card p-5 shadow-card space-y-2">
      <h3 className="font-display font-semibold text-sm text-foreground">Weekly Timetable</h3>
      <p className="text-xs text-muted-foreground">Week starts: {timetableQuery.data?.week_start_date || '--'}</p>
      {timetableQuery.data?.image_url ? (
        <a href={timetableQuery.data.image_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
          View uploaded timetable image
        </a>
      ) : null}
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading menu...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {dayLabels.map((day, i) => (
        <motion.div
          key={day.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="rounded-2xl bg-card p-4 shadow-card"
        >
          <h3 className="font-display font-semibold text-sm text-foreground mb-2">{day.label}</h3>
          <div className="space-y-2">
            {mealKeys.map((meal) => (
              <div key={meal}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{meal}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(structuredMenu?.[day.key]?.[meal] || []).map((item) => (
                    <Badge key={`${day.key}-${meal}-${item}`} className="rounded-full text-[10px] bg-muted text-foreground font-normal">{item}</Badge>
                  ))}
                  {(structuredMenu?.[day.key]?.[meal] || []).length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">No items listed</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>

    {/* Food Rating */}
    <div className="rounded-2xl bg-card p-5 shadow-card">
      <h3 className="font-display font-semibold text-sm text-foreground mb-3">Rate Today's Food</h3>
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} className="p-1" onClick={() => setSelectedRating(s)}>
            <Star className={`h-7 w-7 ${selectedRating >= s ? 'text-primary' : 'text-peach-foreground'} hover:text-primary transition-colors`} />
          </button>
        ))}
      </div>
      <textarea placeholder="Share your feedback about today's food..." className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      <button
        className="mt-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 w-full"
        onClick={() => {
          if (menus.length === 0 || selectedRating <= 0) return;
          submitRating.mutate({ menu_id: menus[0].id, rating: selectedRating, comment: feedback || undefined });
        }}
      >
        {submitRating.isPending ? 'Submitting...' : 'Submit Rating'}
      </button>
    </div>
  </div>
  );
};

export default MessPage;
