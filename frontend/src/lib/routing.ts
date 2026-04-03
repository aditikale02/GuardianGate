import { UserRole } from './constants';

const ADMIN_ONLY_PATH_PREFIXES = ['/admin/wardens', '/admin/users', '/admin/emergency', '/admin/payments'];

export const canAccessPathForRole = (role: UserRole, pathname: string) => {
  if (role === 'student') {
    return pathname.startsWith('/student') || pathname === '/auth/change-password';
  }

  if (pathname === '/auth/change-password') {
    return true;
  }

  if (!pathname.startsWith('/admin')) {
    return false;
  }

  if (role === 'admin') {
    return true;
  }

  return !ADMIN_ONLY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};
