import { motion } from 'framer-motion';
import { BedDouble, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type RoomDetailsResponse = {
  room: {
    number: string;
    block: string;
    floor: string;
    type: string;
    bed_number: number;
    capacity: number;
    occupancy: number;
  } | null;
  roommates: Array<{
    id: string;
    name: string;
    course: string;
    phone: string;
  }>;
  facilities: string[];
  message?: string;
};

const RoomDetailsPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-room-details'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/room/my');
      return parseJsonOrThrow<RoomDetailsResponse>(response, 'Failed to load room details');
    },
  });

  const roomDetails = data;

  return (
  <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">Room Details</h1>
      <p className="text-xs text-muted-foreground mt-0.5">Your room & accommodation info</p>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading room details...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    {roomDetails?.room ? <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card">
      <div className="flex items-center gap-4 mb-4">
        <div className="rounded-xl bg-peach p-3">
          <BedDouble className="h-6 w-6 text-peach-foreground" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Room {roomDetails.room.number}</h2>
          <p className="text-xs text-muted-foreground">{roomDetails.room.type.toLowerCase()} sharing</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-mint/50 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Block</p>
          <p className="font-display font-bold text-foreground">{roomDetails.room.block}</p>
        </div>
        <div className="rounded-xl bg-lavender/50 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Floor</p>
          <p className="font-display font-bold text-foreground">{roomDetails.room.floor}</p>
        </div>
      </div>
    </motion.div> : null}

    {roomDetails && !roomDetails.room ? (
      <div className="rounded-2xl bg-card p-5 shadow-card text-sm text-muted-foreground">
        {roomDetails.message || 'Room allocation details are not available yet.'}
      </div>
    ) : null}

    {/* Roommates */}
    {roomDetails?.room ? <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl bg-card p-5 shadow-card">
      <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" /> Roommate
      </h3>
      {roomDetails.roommates.length === 0 ? <p className="text-xs text-muted-foreground">No roommate assigned.</p> : null}
      {roomDetails.roommates.map(r => (
        <div key={r.name} className="flex items-center gap-3 py-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="font-display font-bold text-primary text-sm">{r.name.charAt(0)}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{r.name}</p>
            <p className="text-xs text-muted-foreground">{r.course}</p>
          </div>
        </div>
      ))}
    </motion.div> : null}

    {/* Facilities */}
    {roomDetails?.room ? <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl bg-card p-5 shadow-card">
      <h3 className="font-display font-semibold text-sm text-foreground mb-3">Room Facilities</h3>
      <div className="flex flex-wrap gap-2">
        {roomDetails.facilities.map((f) => (
          <span key={f} className="rounded-full bg-peach/50 text-foreground text-xs font-medium px-3 py-1.5">{f}</span>
        ))}
      </div>
    </motion.div> : null}
  </div>
  );
};

export default RoomDetailsPage;
