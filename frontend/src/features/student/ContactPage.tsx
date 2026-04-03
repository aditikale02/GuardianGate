import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type ContactsResponse = {
  office_hours: string;
  rows: Array<{
    id: string;
    name: string;
    role: string;
    phone: string;
    email: string;
  }>;
};

const ContactPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['campus-contacts'],
    queryFn: async () => {
      const response = await authenticatedFetch('/campus/contacts');
      return parseJsonOrThrow<ContactsResponse>(response, 'Failed to load contacts');
    },
  });

  const contacts = data?.rows || [];

  return (
  <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
    <div>
      <h1 className="font-display text-xl font-bold text-foreground">Contact & Help</h1>
      <p className="text-xs text-muted-foreground mt-0.5">Warden & hostel office contacts</p>
    </div>

    <div className="rounded-2xl bg-primary/10 p-4">
      <div className="flex items-center gap-2 text-sm text-foreground font-medium">
        <Clock className="h-4 w-4 text-primary" /> Office Hours: {data?.office_hours || '9:00 AM - 6:00 PM (Mon-Sat)'}
      </div>
    </div>

    {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading contacts...</div> : null}
    {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

    <div className="space-y-3">
      {contacts.map(c => (
        <div key={c.id} className="rounded-2xl bg-card p-4 shadow-card">
          <h3 className="font-display font-semibold text-sm text-foreground">{c.name}</h3>
          <p className="text-xs text-muted-foreground mb-3">{c.role}</p>
          <div className="space-y-2">
            <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-primary font-medium">
              <Phone className="h-4 w-4" /> {c.phone}
            </a>
            {c.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-4 w-4" /> {c.email}
              </a>
            )}
          </div>
        </div>
      ))}
      {!isLoading && contacts.length === 0 ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">No contacts available.</div> : null}
    </div>
  </div>
  );
};

export default ContactPage;
