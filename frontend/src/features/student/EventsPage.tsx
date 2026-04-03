import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
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

const EventsPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['campus-events-student'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/events');
      return parseJsonOrThrow<EventsResponse>(response, 'Failed to load events');
    },
  });

  const events = data?.rows || [];

  return (
  <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">Events</h1>
      <p className="text-xs text-muted-foreground mt-0.5">Upcoming & past hostel events</p>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading events...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {events.map((e, i) => (
        <motion.div
          key={e.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className={`rounded-2xl p-4 shadow-card ${e.upcoming ? 'bg-card border-l-4 border-primary' : 'bg-muted/50'}`}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-display font-semibold text-sm text-foreground">{e.title}</h3>
            {e.upcoming && <Badge className="rounded-full text-[10px] bg-mint text-mint-foreground">Upcoming</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mb-3">{e.description || 'Hostel event update'}</p>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(e.event_date).toLocaleDateString()}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(e.event_date).toLocaleTimeString()}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location || '--'}</span>
          </div>
        </motion.div>
      ))}
      {!isLoading && events.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No events available.</div> : null}
    </div>
  </div>
  );
};

export default EventsPage;
