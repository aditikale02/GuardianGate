import { User, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOutletContext } from 'react-router-dom';
import { UserRole } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  role: string;
  first_login: boolean;
  is_active: boolean;
};

const ProfilePage = () => {
  const { user, role } = useOutletContext<{ role: UserRole; user: { name: string; email: string } }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/profile');
      return parseJsonOrThrow<ProfileResponse>(response, 'Failed to load profile');
    },
  });

  const profileName = data?.name || user.name;
  const profileEmail = data?.email || user.email;
  const profileRole = data?.role?.toLowerCase() || role;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Profile</h1>

      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading profile...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}

      <div className="rounded-2xl bg-card shadow-card p-8">
        <div className="flex items-center gap-6 mb-8">
          <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold font-display">
            {profileName.charAt(0)}
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">{profileName}</h2>
            <p className="text-sm text-muted-foreground capitalize">{profileRole}</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { icon: Mail, label: 'Email', value: profileEmail },
            { icon: Phone, label: 'Phone', value: '+91 98765 43210' },
            { icon: MapPin, label: 'Room', value: '102-A, Floor 1' },
          ].map((f) => (
            <div key={f.label} className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <f.icon className="h-4 w-4 text-muted-foreground" /> {f.label}
              </label>
              <Input value={f.value} readOnly className="rounded-xl bg-muted border-0" />
            </div>
          ))}
        </div>

        <Button className="mt-6 rounded-xl">Edit Profile</Button>
      </div>
    </div>
  );
};

export default ProfilePage;
