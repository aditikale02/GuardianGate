import { Calendar, Plus, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type EventsResponse = {
  rows: Array<{
    id: string;
    title: string;
    description: string | null;
    event_date: string;
    location: string | null;
    upcoming: boolean;
  }>;
};

const AdminEventsPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['campus-events-admin'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/events');
      return parseJsonOrThrow<EventsResponse>(response, 'Failed to load events');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const selectedTime = time || '12:00';
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const eventDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0)).toISOString();

      if (!eventDate || Number.isNaN(new Date(eventDate).getTime())) {
        throw new Error('Invalid event date/time');
      }

      const response = await authenticatedFetch('/campus/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          event_date: eventDate,
          location: venue || undefined,
          description: description || undefined,
        }),
      });
      await parseJsonOrThrow(response, 'Failed to create event');
    },
    onSuccess: () => {
      setFormError(null);
      setFormMessage('Event created successfully');
      setShowForm(false);
      setTitle('');
      setDate('');
      setTime('');
      setVenue('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['campus-events-admin'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create event';
      setFormMessage(null);
      setFormError(message);
    },
  });

  const onCreateEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);
    createMutation.mutate();
  };

  const events = data?.rows || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Events Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage hostel events</p>
        </div>
        <Button className="rounded-xl" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> New Event
        </Button>
      </div>

      {showForm && (
        <motion.form onSubmit={onCreateEvent} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
          <Input placeholder="Event title" className="rounded-xl" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" className="rounded-xl" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input type="time" className="rounded-xl" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Input placeholder="Venue" className="rounded-xl" value={venue} onChange={(e) => setVenue(e.target.value)} />
          <textarea placeholder="Description..." className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <Button className="w-full rounded-xl" type="submit" disabled={!title || !date || createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Event'}</Button>
        </motion.form>
      )}

      {formMessage ? <p className="text-sm text-primary">{formMessage}</p> : null}

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading events...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="space-y-3">
        {events.map((e, i) => (
          <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl bg-card p-4 shadow-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-mint p-2.5"><Calendar className="h-5 w-5 text-mint-foreground" /></div>
              <div>
                <p className="text-sm font-semibold text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.event_date).toLocaleDateString()} • {new Date(e.event_date).toLocaleTimeString()} • {e.location || '--'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {e.upcoming && <Badge className="rounded-full text-[10px] bg-mint text-mint-foreground">Upcoming</Badge>}
              <button className="text-xs text-muted-foreground hover:text-foreground"><Edit className="h-4 w-4" /></button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminEventsPage;
