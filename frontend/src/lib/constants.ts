export type UserRole = 'student' | 'warden' | 'admin';

export const DEPARTMENT_OPTIONS = [
  'Computer Engineering',
  'Computer Engineering Regional',
  'AIML',
  'ENTC',
  'Civil',
  'IT',
  'Architecture',
  'Diploma',
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  warden: 'Warden',
  
  admin: 'Admin',
};

export const SIDEBAR_ITEMS = {
  student: [
    { title: 'Attendance', icon: 'CalendarCheck', path: '/student/attendance' },
    { title: 'Missing Reports', icon: 'FileText', path: '/student/missing-reports' },
    { title: 'Notifications', icon: 'Bell', path: '/student/notifications' },
    { title: 'Overview', icon: 'LayoutDashboard', path: '/student' },
    { title: 'Profile', icon: 'User', path: '/student/profile' },
    { title: 'Settings', icon: 'Settings', path: '/student/settings' },
  ],
  warden: [
    { title: 'Attendance', icon: 'CalendarCheck', path: '/admin/attendance' },
    { title: 'Events', icon: 'Calendar', path: '/admin/events' },
    { title: 'Guest Entries', icon: 'UserCheck', path: '/admin/guest-entries' },
    { title: 'Housekeeping', icon: 'Sparkles', path: '/admin/housekeeping' },
    { title: 'Leave Requests', icon: 'Inbox', path: '/admin/leave-requests' },
    { title: 'Maintenance', icon: 'Wrench', path: '/admin/maintenance' },
    { title: 'Medical', icon: 'Stethoscope', path: '/admin/medical' },
    { title: 'Mess & Food', icon: 'UtensilsCrossed', path: '/admin/mess' },
    { title: 'Missing Reports', icon: 'FileText', path: '/admin/missing-reports' },
    { title: 'Notices', icon: 'Megaphone', path: '/admin/notices' },
    { title: 'Overview', icon: 'LayoutDashboard', path: '/admin' },
    { title: 'Parcels', icon: 'Package', path: '/admin/parcels' },
    { title: 'QR Center', icon: 'QrCode', path: '/admin/qr-center' },
    { title: 'Reports', icon: 'BarChart3', path: '/admin/reports' },
    { title: 'Settings', icon: 'Settings', path: '/admin/settings' },
    { title: 'Students', icon: 'GraduationCap', path: '/admin/students' },
    { title: 'Suggestions', icon: 'MessageSquare', path: '/admin/suggestions' },
  ],
  admin: [
    { title: 'Attendance', icon: 'CalendarCheck', path: '/admin/attendance' },
    { title: 'Emergency', icon: 'AlertTriangle', path: '/admin/emergency' },
    { title: 'Events', icon: 'Calendar', path: '/admin/events' },
    { title: 'Guest Entries', icon: 'UserCheck', path: '/admin/guest-entries' },
    { title: 'Housekeeping', icon: 'Sparkles', path: '/admin/housekeeping' },
    { title: 'Leave Requests', icon: 'Inbox', path: '/admin/leave-requests' },
    { title: 'Maintenance', icon: 'Wrench', path: '/admin/maintenance' },
    { title: 'Medical', icon: 'Stethoscope', path: '/admin/medical' },
    { title: 'Mess & Food', icon: 'UtensilsCrossed', path: '/admin/mess' },
    { title: 'Missing Reports', icon: 'FileText', path: '/admin/missing-reports' },
    { title: 'Notices', icon: 'Megaphone', path: '/admin/notices' },
    { title: 'Overview', icon: 'LayoutDashboard', path: '/admin' },
    { title: 'Parcels', icon: 'Package', path: '/admin/parcels' },
    { title: 'Payments', icon: 'CreditCard', path: '/admin/payments' },
    { title: 'QR Center', icon: 'QrCode', path: '/admin/qr-center' },
    { title: 'Reports', icon: 'BarChart3', path: '/admin/reports' },
    { title: 'Settings', icon: 'Settings', path: '/admin/settings' },
    { title: 'Students', icon: 'GraduationCap', path: '/admin/students' },
    { title: 'Suggestions', icon: 'MessageSquare', path: '/admin/suggestions' },
    { title: 'User Management', icon: 'Users', path: '/admin/users' },
    { title: 'Wardens', icon: 'Shield', path: '/admin/wardens' },
  ],
} as const;
