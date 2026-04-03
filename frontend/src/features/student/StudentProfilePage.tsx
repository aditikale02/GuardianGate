import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, GraduationCap, BedDouble, Heart, Edit } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useOutletContext } from 'react-router-dom';
import { UserRole } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, parseJsonOrThrow } from '@/lib/session';

const fallbackProfile = {
  name: 'Priya Sharma',
  email: 'priya@hostel.edu',
  phone: '+91 98765 43210',
  dob: 'June 15, 2004',
  course: 'B.Tech CSE — 3rd Year',
  department: 'Computer Science & Engineering',
  block: 'A',
  room: '204',
  floor: '2nd Floor',
  address: '42, MG Road, Pune, Maharashtra 411001',
  guardian: 'Mr. Rajesh Sharma',
  guardianPhone: '+91 91234 56789',
  emergencyContact: '+91 88888 99999',
  bloodGroup: 'B+',
  medicalNotes: 'No known allergies',
  idProof: 'Aadhar — XXXX XXXX 4521',
};

type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  role: string;
  first_login: boolean;
  is_active: boolean;
};

const StudentProfilePage = () => {
  const { user } = useOutletContext<{ role: UserRole; user: { name: string; email: string } }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => {
      const response = await authenticatedFetch('/dashboard/profile');
      return parseJsonOrThrow<ProfileResponse>(response, 'Failed to load profile');
    },
  });

  const profile = {
    ...fallbackProfile,
    name: data?.name || user.name,
    email: data?.email || user.email,
  };

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {isLoading ? <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Loading profile...</div> : null}
      {error ? <div className="rounded-2xl bg-card p-4 text-sm text-destructive">{(error as Error).message}</div> : null}
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card p-5 shadow-card text-center">
        <Avatar className="h-20 w-20 mx-auto border-4 border-primary/20">
          <AvatarFallback className="bg-primary text-primary-foreground font-display text-2xl font-bold">
            {profile.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <h2 className="font-display text-xl font-bold text-foreground mt-3">{profile.name}</h2>
        <p className="text-xs text-muted-foreground">{profile.course}</p>
        <div className="flex justify-center gap-2 mt-3">
          <span className="rounded-full bg-primary/10 text-primary text-xs font-medium px-3 py-1">Block {profile.block}</span>
          <span className="rounded-full bg-mint/60 text-mint-foreground text-xs font-medium px-3 py-1">Room {profile.room}</span>
        </div>
        <Button variant="outline" size="sm" className="mt-4 rounded-xl">
          <Edit className="h-3.5 w-3.5 mr-1" /> Edit Profile
        </Button>
      </motion.div>

      {/* Personal Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
        <h3 className="font-display font-semibold text-sm text-foreground">Personal Details</h3>
        {[
          { icon: Mail, label: 'Email', value: profile.email },
          { icon: Phone, label: 'Phone', value: profile.phone },
          { icon: User, label: 'DOB', value: profile.dob },
          { icon: MapPin, label: 'Address', value: profile.address },
          { icon: Heart, label: 'Blood Group', value: profile.bloodGroup },
        ].map(item => (
          <div key={item.label} className="flex items-start gap-3 py-1">
            <item.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p className="text-sm text-foreground">{item.value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Academic Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
        <h3 className="font-display font-semibold text-sm text-foreground">Academic Details</h3>
        <div className="flex items-start gap-3 py-1">
          <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-[10px] text-muted-foreground">Department</p>
            <p className="text-sm text-foreground">{profile.department}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 py-1">
          <BedDouble className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-[10px] text-muted-foreground">Hostel</p>
            <p className="text-sm text-foreground">Block {profile.block} • Room {profile.room} • {profile.floor}</p>
          </div>
        </div>
      </motion.div>

      {/* Guardian */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl bg-card p-5 shadow-card space-y-3">
        <h3 className="font-display font-semibold text-sm text-foreground">Guardian & Emergency</h3>
        <div className="flex items-start gap-3 py-1">
          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-[10px] text-muted-foreground">Guardian</p>
            <p className="text-sm text-foreground">{profile.guardian}</p>
            <p className="text-xs text-muted-foreground">{profile.guardianPhone}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 py-1">
          <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-[10px] text-muted-foreground">Emergency Contact</p>
            <p className="text-sm text-foreground">{profile.emergencyContact}</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Medical:</span> {profile.medicalNotes}
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">ID Proof:</span> {profile.idProof}
        </div>
      </motion.div>
    </div>
  );
};

export default StudentProfilePage;
