import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Brand/Logo';
import { bootstrapSession, changePassword, getHomePathForRole, getSession, logoutSession, shouldForcePasswordChange } from '@/lib/session';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const ForcePasswordChangePage = () => {
  const navigate = useNavigate();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      await bootstrapSession();
      if (!mounted) return;

      const session = getSession();
      if (!session.role || !session.user) {
        navigate('/');
        return;
      }

      if (!shouldForcePasswordChange(session.user)) {
        navigate(getHomePathForRole(session.role));
        return;
      }

      setIsBootstrapping(false);
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword);
      const session = getSession();

      if (!session.role) {
        navigate('/');
        return;
      }

      navigate(getHomePathForRole(session.role));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to update password'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onLogout = async () => {
    await logoutSession();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      {isBootstrapping ? (
        <div className="mx-auto mt-20 flex h-16 items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : null}

      {!isBootstrapping ? (
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
        </div>

        <h1 className="font-display text-2xl font-semibold text-foreground">Change Your Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account uses a temporary password. Set a new password to continue.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Update password'}
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={onLogout}>
              Sign out
            </Button>
          </div>
        </form>
      </div>
      ) : null}
    </div>
  );
};

export default ForcePasswordChangePage;
