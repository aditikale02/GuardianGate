import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type MenuResponse = {
  rows: Array<{
    id: string;
    meal_type: string;
    items: string[];
  }>;
};

type FeedbackSummaryResponse = {
  rows: Array<{
    meal_type: string;
    avg_rating: number;
    likes: number;
    dislikes: number;
  }>;
};

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

const blankTimetable = (): TimetableShape => ({
  monday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  tuesday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  wednesday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  thursday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  friday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  saturday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
  sunday: { breakfast: [], lunch: [], snacks: [], dinner: [] },
});

const blankDraftStructured = (): Record<DayKey, Record<MealKey, string>> => ({
  monday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
  tuesday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
  wednesday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
  thursday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
  friday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
  saturday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
  sunday: { breakfast: '', lunch: '', snacks: '', dinner: '' },
});

const mealColors: Record<string, string> = { breakfast: 'bg-peach', lunch: 'bg-mint', snacks: 'bg-lavender', dinner: 'bg-blush' };

const AdminMessPage = () => {
  const queryClient = useQueryClient();
  const [weekStartDate, setWeekStartDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [draftStructured, setDraftStructured] = useState<Record<DayKey, Record<MealKey, string>>>(() => blankDraftStructured());

  const { data: timetableData, isLoading: menuLoading, error: menuError } = useQuery({
    queryKey: ['admin-mess-timetable'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/mess/timetable');
      return parseJsonOrThrow<TimetableResponse>(response, 'Failed to load timetable');
    },
  });

  const { data: feedbackData, isLoading: feedbackLoading, error: feedbackError } = useQuery({
    queryKey: ['admin-mess-feedback'],
    queryFn: async () => {
      const response = await authenticatedFetch('/workflows/mess/feedback-summary');
      return parseJsonOrThrow<FeedbackSummaryResponse>(response, 'Failed to load feedback summary');
    },
  });

  const menuMutation = useMutation({
    mutationFn: async (payload: { structured_menu: TimetableShape; image_url?: string; week_start_date: string }) => {
      const response = await authenticatedFetch('/workflows/mess/timetable', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await parseJsonOrThrow(response, 'Failed to update weekly timetable');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-mess-timetable'] }),
  });

  useEffect(() => {
    if (!timetableData) return;
    setWeekStartDate(timetableData.week_start_date);
    setImageUrl(timetableData.image_url || '');

    const next = blankDraftStructured();
    for (const day of dayLabels) {
      for (const meal of mealKeys) {
        next[day.key][meal] = (timetableData.structured_menu?.[day.key]?.[meal] || []).join(', ');
      }
    }
    setDraftStructured(next);
  }, [timetableData]);

  const feedbackStats = useMemo(() => {
    const rows = feedbackData?.rows || [];
    return rows.map((row) => ({
      meal: row.meal_type,
      rating: row.avg_rating,
      likes: row.likes,
      dislikes: row.dislikes,
    }));
  }, [feedbackData]);

  const saveMenu = () => {
    const structured: TimetableShape = blankTimetable();
    for (const day of dayLabels) {
      for (const meal of mealKeys) {
        structured[day.key][meal] = draftStructured[day.key][meal]
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    menuMutation.mutate({
      week_start_date: weekStartDate,
      structured_menu: structured,
      image_url: imageUrl || undefined,
    });
  };

  return (
  <div className="space-y-6 max-w-4xl">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Mess & Food Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Edit structured weekly timetable and image reference</p>
      </div>
      <Button className="rounded-xl" onClick={saveMenu}><Edit className="h-4 w-4 mr-1" /> Save Menu</Button>
    </div>

    {menuLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading menu...</div> : null}
    {menuError ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(menuError as Error).message}</div> : null}

    <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Week Start</p>
          <input
            type="date"
            value={weekStartDate}
            onChange={(event) => setWeekStartDate(event.target.value)}
            className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm"
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Timetable Image URL</p>
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://..."
            className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>
      {imageUrl ? (
        <a href={imageUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
          Preview timetable image
        </a>
      ) : null}
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      {dayLabels.map((day, i) => (
        <motion.div
          key={day.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-2xl bg-card p-4 shadow-card"
        >
          <h3 className="font-display font-semibold text-foreground mb-3">{day.label}</h3>
          <div className="space-y-2">
            {mealKeys.map((meal) => (
              <div key={meal}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{meal}</p>
                <textarea
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
                  placeholder="Comma-separated items"
                  value={draftStructured[day.key][meal]}
                  onChange={(event) =>
                    setDraftStructured((prev) => ({
                      ...prev,
                      [day.key]: {
                        ...prev[day.key],
                        [meal]: event.target.value,
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>

    <div className="rounded-2xl bg-card p-5 shadow-card">
      <h3 className="font-display font-semibold text-foreground mb-4">Food Feedback Summary</h3>
      {feedbackLoading ? <div className="text-sm text-muted-foreground">Loading feedback summary...</div> : null}
      {feedbackError ? <div className="text-sm text-destructive">{(feedbackError as Error).message}</div> : null}
      <div className="space-y-3">
        {feedbackStats.map(f => (
          <div key={f.meal} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <span className="text-sm font-medium text-foreground">{f.meal}</span>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>⭐ {f.rating}</span>
              <span>👍 {f.likes}</span>
              <span>👎 {f.dislikes}</span>
            </div>
          </div>
        ))}
        {!feedbackLoading && feedbackStats.length === 0 ? <div className="text-sm text-muted-foreground">No feedback ratings yet.</div> : null}
      </div>
    </div>
  </div>
  );
};

export default AdminMessPage;
